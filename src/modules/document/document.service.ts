import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import {
  generateS3Key,
  getPresignedUploadUrl,
  getPresignedViewUrl,
  deleteFromS3,
  ALLOWED_DOCUMENT_TYPES,
} from '../../utils/s3';
import type { Prisma, DocumentCategory } from '../../types';

export class DocumentService {
  // ============================================
  // PRESIGNED UPLOAD (step 1 — get URL)
  // ============================================

  async getUploadUrl(data: {
    fileName: string;
    contentType: string;
    category: DocumentCategory;
    name: string;
    description?: string;
    isAdminDoc?: boolean;
  }, uploadedById: string) {
    if (!ALLOWED_DOCUMENT_TYPES.includes(data.contentType)) {
      throw new AppError(`Unsupported file type. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`, 400);
    }

    const s3Key = generateS3Key('general', uploadedById, data.fileName);
    const { uploadUrl } = await getPresignedUploadUrl(s3Key, data.contentType);

    return {
      uploadUrl,
      s3Key,
      // Return metadata so client can confirm after upload
      meta: {
        fileName: data.fileName,
        contentType: data.contentType,
        category: data.category,
        name: data.name,
        description: data.description,
        isAdminDoc: data.isAdminDoc ?? false,
      },
    };
  }

  // ============================================
  // CONFIRM UPLOAD (step 2 — save to DB)
  // ============================================

  async confirmUpload(data: {
    s3Key: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    category: DocumentCategory;
    name: string;
    description?: string;
    isAdminDoc?: boolean;
  }, uploadedById: string, societyId: string) {
    const fileSizeMB = data.fileSizeBytes / (1024 * 1024);

    const document = await prisma.societyDocument.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        fileUrl: `https://${process.env.S3_BUCKET_NAME || 'society-gate-documents'}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${data.s3Key}`,
        fileKey: data.s3Key,
        fileName: data.fileName,
        fileSizeMB: parseFloat(fileSizeMB.toFixed(2)),
        fileType: data.fileType.toUpperCase().replace('APPLICATION/', '').replace('IMAGE/', ''),
        isAdminDoc: data.isAdminDoc ?? false,
        uploadedById,
        societyId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
    });

    return document;
  }

  // ============================================
  // LIST DOCUMENTS
  // ============================================

  async getDocuments(filters: {
    societyId: string;
    requestingUserId: string;
    category?: DocumentCategory;
    isAdminDoc?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { societyId, requestingUserId, category, isAdminDoc, page = 1, limit = 20 } = filters;

    // Residents see: all admin docs + their own personal docs
    // Admins see everything
    const where: Prisma.SocietyDocumentWhereInput = {
      societyId,
      OR: [
        { isAdminDoc: true },
        { isAdminDoc: false, uploadedById: requestingUserId },
      ],
    };

    if (category) where.category = category;
    if (isAdminDoc !== undefined) {
      // Explicit filter overrides the OR logic
      delete where.OR;
      where.isAdminDoc = isAdminDoc;
      if (!isAdminDoc) where.uploadedById = requestingUserId;
    }

    const [documents, total] = await Promise.all([
      prisma.societyDocument.findMany({
        where,
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ isAdminDoc: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.societyDocument.count({ where }),
    ]);

    return {
      documents,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // VIEW URL (presigned, time-limited)
  // ============================================

  async getViewUrl(documentId: string, requestingUserId: string, userRole: string) {
    const doc = await prisma.societyDocument.findUnique({ where: { id: documentId } });

    if (!doc) throw new AppError('Document not found', 404);

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    const isOwner = doc.uploadedById === requestingUserId;

    if (!doc.isAdminDoc && !isOwner && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    const viewUrl = await getPresignedViewUrl(doc.fileKey);

    return { viewUrl, expiresInSeconds: 3600 };
  }

  // ============================================
  // DELETE
  // ============================================

  async deleteDocument(documentId: string, requestingUserId: string, userRole: string) {
    const doc = await prisma.societyDocument.findUnique({ where: { id: documentId } });

    if (!doc) throw new AppError('Document not found', 404);

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    const isOwner = doc.uploadedById === requestingUserId;

    if (!isOwner && !isAdmin) {
      throw new AppError('You can only delete your own documents', 403);
    }

    // Delete from S3 and DB together
    await Promise.all([
      deleteFromS3(doc.fileKey),
      prisma.societyDocument.delete({ where: { id: documentId } }),
    ]);

    return { message: 'Document deleted successfully' };
  }
}
