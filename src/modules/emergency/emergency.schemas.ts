import { z } from 'zod';

// Phase 2: allow-list for raising an emergency. societyId comes from the caller's
// context (not the body); status/respondedBy/notifiedUsers are server-set.
export const createEmergencySchema = z.object({
  type: z.enum(['HARASSMENT', 'MEDICAL', 'FIRE', 'SECURITY', 'LIFT_STUCK', 'ANIMAL_THREAT', 'THEFT', 'VIOLENCE', 'ACCIDENT', 'OTHER']),
  flatId: z.string().uuid().optional(),
  /** The tower / block where it is happening (from the places list); a common area is sent as `location` text instead */
  blockId: z.string().uuid().optional(),
  /** One reading taken when the alarm is raised. Optional: a phone without a fix still raises the alarm. */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(200).optional(),
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;
