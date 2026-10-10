import { z } from 'zod';

// Phase 2: allow-list for raising an emergency. societyId comes from the caller's
// context (not the body); status/respondedBy/notifiedUsers are server-set.
export const createEmergencySchema = z.object({
  type: z.enum(['MEDICAL', 'FIRE', 'SECURITY', 'LIFT_STUCK', 'ANIMAL_THREAT', 'THEFT', 'VIOLENCE', 'ACCIDENT', 'OTHER']),
  flatId: z.string().uuid().optional(),
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(200).optional(),
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;
