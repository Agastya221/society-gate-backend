import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import {
  generateS3Key,
  getPresignedUploadUrl,
  getPresignedViewUrl,
  deleteFromS3,
  isValidFileType,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_PHOTO_TYPES,
} from '../../utils/s3';
import { DocumentType } from '../../../prisma/generated/prisma/enums';

type UploadContext = 'onboarding' | 'entry-photo';

interface PresignedUrlRequest {
  context: UploadContext;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType?: DocumentType;
}

interface ConfirmUploadRequest {
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType: DocumentType;
  onboardingRequestId?: string;
}

export class UploadService {
  /**
   * Get a pre-signed URL for uploading a file
   */
  async getPresignedUrl(
    data: PresignedUrlRequest,
    userId: string
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const { context, fileName, mimeType, fileSize } = data;

    // Validate file type based on context
    const allowedTypes =
      context === 'entry-photo' ? ALLOWED_PHOTO_TYPES : ALLOWED_DOCUMENT_TYPES;

    if (!isValidFileType(mimeType, allowedTypes)) {
      throw new AppError(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        400
      );
    }

    // Validate file size (max 10MB for documents, 5MB for photos)
    const maxSize = context === 'entry-photo' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (fileSize > maxSize) {
      throw new AppError(
        `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
        400
      );
    }

    // Generate S3 key
    const folder = context === 'entry-photo' ? 'entry-photos' : 'onboarding';
    const s3Key = generateS3Key(folder, userId, fileName);

    // Get pre-signed upload URL
    return getPresignedUploadUrl(s3Key, mimeType);
  }

  /**
   * Confirm upload and save document metadata to database
   */
  async confirmUpload(
    data: ConfirmUploadRequest,
    userId: string
  ) {
    const { s3Key, fileName, mimeType, fileSize, documentType, onboardingRequestId } =
      data;

    if (!onboardingRequestId) {
      throw new AppError('onboardingRequestId is required for document uploads', 400);
    }

    // Verify the onboarding request exists and belongs to the user
    const onboardingRequest = await prisma.onboardingRequest.findUnique({
      where: { id: onboardingRequestId },
    });

    if (!onboardingRequest) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (onboardingRequest.userId !== userId) {
      throw new AppError('You can only upload documents for your own onboarding request', 403);
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

    // Check ownership or admin access
    const isOwner = document.onboardingRequest.userId === userId;
    const isAdmin =
      requestingUser.role === 'ADMIN' &&
      requestingUser.societyId === document.onboardingRequest.societyId;
    const isSuperAdmin = requestingUser.role === 'SUPER_ADMIN';

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
    user: { id: string; role: string; societyId: string | null },
    document: { onboardingRequest: { userId: string; societyId: string | null } }
  ): boolean {
    // Super admin can view all
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Owner can view their own documents
    if (document.onboardingRequest.userId === user.id) {
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
