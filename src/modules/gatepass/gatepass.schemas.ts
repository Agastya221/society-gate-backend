import { z } from 'zod';

// Phase 2: allow-lists for gate pass writes. Unknown keys (status, qrToken,
// approvedById, isUsed, societyId, ...) are stripped — those are server-set.

const optText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => v || undefined);

const base = {
  // Admins may target a flat; ignored for residents (service uses their own flat).
  flatId: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: optText(1000),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  attachments: z.array(z.string().max(512)).max(10).optional(),
};

const vehicleFields = {
  vehicleNumber: optText(20),
  driverName: optText(100),
  driverPhone: optText(20),
};

const itemsList = z.array(z.string().trim().min(1).max(200)).max(100).optional();

const workerFields = {
  workerName: optText(100),
  workerPhone: optText(20),
  companyName: optText(200),
};

export const createGatePassSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('MATERIAL'), ...base, ...vehicleFields, itemsList }),
    z.object({ type: z.literal('MOVE_IN'), ...base, ...vehicleFields, itemsList }),
    z.object({ type: z.literal('MOVE_OUT'), ...base, ...vehicleFields, itemsList }),
    z.object({ type: z.literal('VEHICLE'), ...base, ...vehicleFields }),
    z.object({ type: z.literal('MAINTENANCE'), ...base, ...workerFields }),
  ])
  .refine((d) => d.validUntil > d.validFrom, {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
  });

export type CreateGatePassInput = z.infer<typeof createGatePassSchema>;

export const rejectGatePassSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const scanGatePassSchema = z.object({
  qrToken: z.string().trim().min(1, 'qrToken is required').max(2048),
});
