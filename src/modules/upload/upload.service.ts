import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import {
  generateS3Key,
  getPresignedUploadUrl,
  getPresignedViewUrl,
  deleteFromS3,
  isOwnedUploadKey,
  isValidFileType,
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
} from '../../utils/s3';
import {
  UPLOAD_CONTEXT_RULES,
  type ConfirmUploadInput,
  type PresignedUrlInput,
} from './upload.schemas';

export class UploadService {
  /**
   * Get a pre-signed URL for uploading a file.
   * The key is generated server-side under `<folder>/<userId>/`, and the declared
   * size + type are signed into the URL so S3 rejects a different body.
   */
  async getPresignedUrl(
    data: PresignedUrlInput,
    userId: string
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const { context, fileName, mimeType, fileSize } = data;
    const rules = UPLOAD_CONTEXT_RULES[context];

    if (!isValidFileType(mimeType, rules.mimeTypes)) {
      throw new AppError(
        `Invalid file type. Allowed types: ${rules.mimeTypes.join(', ')}`,
        400
      );
    }

    if (fileSize > rules.maxBytes) {
      throw new AppError(
        `File too large. Maximum size: ${rules.maxBytes / (1024 * 1024)}MB`,
        400
      );
    }

    const folder = context === 'entry-photo'
      ? 'entry-photos'
      : context === 'staff-photo'
        ? 'staff-photos'
        : 'onboarding';
    const s3Key = generateS3Key(folder, userId, fileName, mimeType);

    return getPresignedUploadUrl(s3Key, mimeType, undefined, fileSize);
  }

  /**
   * Confirm upload and save document metadata to database
   */
  async confirmUpload(
    data: ConfirmUploadInput,
    userId: string
  ) {
    const { s3Key, fileName, mimeType, fileSize, documentType, onboardingRequestId } =
      data;

    // Only keys we issued to this user for onboarding documents may be attached.
    if (!isOwnedUploadKey(s3Key, userId, ['onboarding'])) {
      throw new AppError('Invalid file key', 400);
    }

    if (!isValidFileType(mimeType, ALLOWED_DOCUMENT_TYPES)) {
      throw new AppError(
        `Invalid file type. Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`,
        400
      );
    }

    if (fileSize > MAX_DOCUMENT_BYTES) {
      throw new AppError(
        `File too large. Maximum size: ${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB`,
        400
      );
    }

    // Verify the onboarding request exists and belongs to the user
    const onboardingRequest = await prisma.onboardingRequest.findFirst({
      where: { id: onboardingRequestId, userId },
      select: { id: true, status: true },
    });

    if (!onboardingRequest) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (onboardingRequest.status === 'APPROVED') {
      throw new AppError('Documents cannot be added to an approved request', 400);
    }

    // Create the document record
    const document = await prisma.residentDocument.create({
      data: {
        onboardingRequestId,
        documentType,
        documentUrl: s3Key, // Store S3 key instead of full URL
        fileName,
        fileSize,
        mimeType,
      },
    });

    return document;
  }

  /**
   * Get a pre-signed view URL for a document (with RBAC)
   */
  async getViewUrl(documentId: string, userId: string): Promise<string> {
    // Get the document with related data for RBAC check
    const document = await prisma.residentDocument.findUnique({
      where: { id: documentId },
      include: {
        onboardingRequest: {
          include: {
            user: { select: { id: true, societyId: true } },
          },
        },
      },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Get the requesting user
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, societyId: true, isActive: true },
    });

    if (!requestingUser) {
      throw new AppError('User not found', 404);
    }

    // RBAC check
    const canView = this.canViewDocument(requestingUser, document);
    if (!canView) {
      throw new AppError('Access denied', 403);
    }

    // Generate pre-signed view URL
    return getPresignedViewUrl(document.documentUrl);
  }

  /**
   * Delete a document (with ownership check)
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await prisma.residentDocument.findUnique({
      where: { id: documentId },
      include: {
        onboardingRequest: true,
      },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Get the requesting user
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!requestingUser) {
      throw new AppError('User not found', 404);
    }

    // Check ownership or admin access. These routes also run under
    // authenticateForOnboarding (inactive users allowed), so admin rights
    // require an active account.
    const isOwner = document.onboardingRequest.userId === userId;
    const isAdmin =
      requestingUser.isActive &&
      requestingUser.role === 'ADMIN' &&
      requestingUser.societyId === document.onboardingRequest.societyId;
    const isSuperAdmin = requestingUser.isActive && requestingUser.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin && !isSuperAdmin) {
      throw new AppError('Access denied', 403);
    }

    // Delete from S3
    await deleteFromS3(document.documentUrl);

    // Delete from database
    await prisma.residentDocument.delete({
      where: { id: documentId },
    });
  }

  /**
   * Get view URL for entry request photo (with RBAC)
   */
  async getEntryPhotoViewUrl(
    entryRequestId: string,
    userId: string
  ): Promise<string> {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: {
        flat: {
          include: {
            residents: { select: { id: true } },
          },
        },
      },
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    if (!entryRequest.photoKey) {
      throw new AppError('No photo available for this entry request', 404);
    }

    // Get the requesting user
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!requestingUser) {
      throw new AppError('User not found', 404);
    }

    // RBAC: Only flat residents, society admin, or super admin can view
    const isFlatResident = entryRequest.flat.residents.some((r) => r.id === userId);
    const isSocietyAdmin =
      requestingUser.role === 'ADMIN' &&
      requestingUser.societyId === entryRequest.societyId;
    const isSuperAdmin = requestingUser.role === 'SUPER_ADMIN';

    if (!isFlatResident && !isSocietyAdmin && !isSuperAdmin) {
      throw new AppError('Access denied', 403);
    }

    return getPresignedViewUrl(entryRequest.photoKey);
  }

  /**
   * Check if a user can view a document
   */
  private canViewDocument(
    user: { id: string; role: string; societyId: string | null; isActive: boolean },
    document: { onboardingRequest: { userId: string; societyId: string | null } }
  ): boolean {
    // Owner can view their own documents
    if (document.onboardingRequest.userId === user.id) {
      return true;
    }

    // Admin rights need an active account (the onboarding route admits inactive users)
    if (!user.isActive) {
      return false;
    }

    // Super admin can view all
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Society admin can view documents from their society
    if (
      user.role === 'ADMIN' &&
      user.societyId === document.onboardingRequest.societyId
    ) {
      return true;
    }

    return false;
  }
}
