import { z } from 'zod';

// Allow-lists for notice writes. societyId, createdById and viewCount are
// server-controlled and stripped.

const NOTICE_TYPES = ['GENERAL', 'URGENT', 'EVENT', 'MAINTENANCE', 'MEETING', 'EMERGENCY'] as const;
const NOTICE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const dateField = z.coerce.date();

// The admin app sends `content`; accept it as an alias for `description`.
const withAliases = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return raw;
  const b = { ...(raw as Record<string, unknown>) };
  if (b.description === undefined && b.content !== undefined) b.description = b.content;
  return b;
};

const fields = {
  type: z.enum(NOTICE_TYPES),
  priority: z.enum(NOTICE_PRIORITIES).optional(),
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().trim().min(1, 'Description is required').max(10000),
  images: z.array(z.string().trim().min(1).max(2048)).max(20).optional(),
  documents: z.array(z.string().trim().min(1).max(2048)).max(20).optional(),
  isUrgent: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  publishAt: dateField.optional(),
  expiresAt: dateField.optional().nullable(),
};

export const createNoticeSchema = z.preprocess(withAliases, z.object(fields));

export const updateNoticeSchema = z.preprocess(
  withAliases,
  z.object({
    type: fields.type.optional(),
    priority: fields.priority,
    title: fields.title.optional(),
    description: fields.description.optional(),
    images: fields.images,
    documents: fields.documents,
    isUrgent: fields.isUrgent,
    isPinned: fields.isPinned,
    publishAt: fields.publishAt,
    expiresAt: fields.expiresAt,
    isActive: z.boolean().optional(),
  })
);

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
