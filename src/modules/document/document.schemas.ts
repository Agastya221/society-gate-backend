import { z } from 'zod';

// Phase 2: allow-lists for document writes. isAdminDoc is accepted here but the
// controller forces it to false for anyone who is not ADMIN/SUPER_ADMIN.

const categoryEnum = z.enum([
  'RULES_AND_BYLAWS', 'MEETING_MINUTES', 'FINANCIAL', 'CIRCULAR', 'MAINTENANCE', 'LEGAL', 'PERSONAL', 'OTHER',
]);

export const getUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(100),
  category: categoryEnum,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  isAdminDoc: z.boolean().optional(),
});

export const confirmUploadSchema = z.object({
  s3Key: z.string().min(1).max(512),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().trim().min(1).max(100),
  fileSizeBytes: z.coerce.number().int().min(0).max(50 * 1024 * 1024),
  category: categoryEnum,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  isAdminDoc: z.boolean().optional(),
});
