import { z } from 'zod';

// Allow-lists for post/comment writes. Counters (likesCount, commentsCount),
// isActive, authorId and societyId are server-controlled and stripped.
// isPinned is accepted here but only honoured for admins (see service).

export const POST_CATEGORIES = [
  'GENERAL', 'ANNOUNCEMENT', 'QUESTION', 'ISSUE', 'APPRECIATION', 'HELP',
  'EVENT', 'MAINTENANCE', 'LOST_FOUND', 'SAFETY', 'FOR_SALE',
] as const;

export const createPostSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  content: z.string().trim().min(1, 'Content is required').max(5000),
  category: z.enum(POST_CATEGORIES).optional(),
  isAnonymous: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Content is required').max(2000),
  isAnonymous: z.boolean().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
