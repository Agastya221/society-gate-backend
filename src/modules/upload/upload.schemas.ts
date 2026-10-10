import { z } from 'zod';
import { DocumentType } from '../../../prisma/generated/prisma/enums';
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_PHOTO_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
} from '../../utils/s3';

export const UPLOAD_CONTEXTS = ['onboarding', 'entry-photo', 'staff-photo'] as const;
export type UploadContext = (typeof UPLOAD_CONTEXTS)[number];

/** Per-context allowed mime types and size cap. */
export const UPLOAD_CONTEXT_RULES: Record<UploadContext, { mimeTypes: string[]; maxBytes: number }> = {
  onboarding: { mimeTypes: ALLOWED_DOCUMENT_TYPES, maxBytes: MAX_DOCUMENT_BYTES },
  'entry-photo': { mimeTypes: ALLOWED_PHOTO_TYPES, maxBytes: MAX_PHOTO_BYTES },
  'staff-photo': { mimeTypes: ALLOWED_PHOTO_TYPES, maxBytes: MAX_PHOTO_BYTES },
};

const fileNameSchema = z.string().trim().min(1).max(255);
const fileSizeSchema = z.coerce.number().int().positive();

export const presignedUrlSchema = z.object({
  context: z.enum(UPLOAD_CONTEXTS),
  fileName: fileNameSchema,
  mimeType: z.string().trim().min(1).max(100),
  fileSize: fileSizeSchema,
  documentType: z.enum(DocumentType).optional(),
});

export const confirmUploadSchema = z.object({
  s3Key: z.string().trim().min(1).max(512),
  fileName: fileNameSchema,
  mimeType: z.string().trim().min(1).max(100),
  fileSize: fileSizeSchema,
  documentType: z.enum(DocumentType),
  onboardingRequestId: z.string().uuid(),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
