import { z } from 'zod';

// Allow-lists for poll writes. Unknown keys (societyId, createdById, status on
// create, vote counts, ...) are stripped, never passed to Prisma.

const optionalDate = z
  .union([z.string().min(1), z.date()])
  .optional()
  .nullable()
  .refine((v) => v == null || !Number.isNaN(new Date(v).getTime()), 'Invalid date');

// The admin app sends `question` / `endDate`; accept them as aliases.
const withAliases = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return raw;
  const b = { ...(raw as Record<string, unknown>) };
  if (b.title === undefined && b.question !== undefined) b.title = b.question;
  if (b.votingEndsAt === undefined && b.endDate !== undefined) b.votingEndsAt = b.endDate;
  return b;
};

export const createPollSchema = z.preprocess(
  withAliases,
  z.object({
    title: z.string().trim().min(1, 'Title is required').max(300),
    description: z.string().trim().max(2000).optional(),
    isAnonymous: z.boolean().optional(),
    allowMultiple: z.boolean().optional(),
    votingEndsAt: optionalDate,
    options: z.array(z.string().trim().min(1).max(200)).min(2, 'Poll must have at least 2 options').max(20),
  })
);

export const updatePollSchema = z.preprocess(
  withAliases,
  z.object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
    votingEndsAt: optionalDate,
  })
);

export const castVoteSchema = z.object({
  optionId: z.string().min(1, 'optionId is required'),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;
export type UpdatePollInput = z.infer<typeof updatePollSchema>;
