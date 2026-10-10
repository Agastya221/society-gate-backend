import { z } from 'zod';

// ============================================
// VEHICLE + PARKING VIOLATION SCHEMAS
// (module-local; src/schemas/index.ts is shared)
// ============================================

/** Upper bound for a single parking penalty, in INR. */
export const MAX_PARKING_PENALTY_INR = 10000;

export const violationTypeEnum = z.enum([
  'WRONG_PARKING',
  'DOUBLE_PARKING',
  'BLOCKING_GATE',
  'UNAUTHORIZED_SPOT',
  'NO_STICKER',
  'OTHER',
]);
export const violationSourceEnum = z.enum(['OFFICIAL', 'COMPLAINT']);
export const violationStatusEnum = z.enum(['OPEN', 'NOTIFIED', 'RESOLVED', 'DISMISSED']);
export const vehicleStatusEnum = z.enum(['PENDING', 'ACTIVE', 'REJECTED']);

const vehicleNumberField = z.string().trim().min(1).max(20);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

// Numeric strings ("500") are accepted; empty string / null / undefined mean "no penalty".
const penaltyField = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return undefined;
    if (typeof v === 'string') return Number(v);
    return v;
  },
  z
    .number()
    .finite()
    .positive('penaltyAmount must be greater than 0')
    .max(MAX_PARKING_PENALTY_INR, `penaltyAmount cannot exceed ${MAX_PARKING_PENALTY_INR}`)
    .optional()
);

/** POST /{admin,gate}/parking/violations and /parking/vehicles/:vehicleId/violations */
export const issueViolationSchema = z.object({
  vehicleNumber: vehicleNumberField.optional(),
  plateNumber: vehicleNumberField.optional(),
  type: violationTypeEnum,
  description: optionalText(1000),
  penaltyAmount: penaltyField,
  addToInvoice: z.boolean().optional(),
});

/** POST /resident/parking/complaints */
export const fileComplaintSchema = z.object({
  vehicleNumber: vehicleNumberField,
  type: violationTypeEnum,
  description: optionalText(1000),
});

/** PATCH /admin/parking/violations/:id/resolve */
export const resolveViolationSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionNote: optionalText(1000),
});

/** GET .../parking/violations query */
export const listViolationsQuerySchema = z.object({
  source: violationSourceEnum.optional(),
  status: violationStatusEnum.optional(),
  vehicleId: z.string().min(1).max(64).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

/** POST /resident/vehicles — only these keys reach Prisma. */
export const registerVehicleSchema = z.object({
  vehicleNumber: vehicleNumberField,
  vehicleType: z.string().trim().min(1).max(30),
  model: optionalText(100),
  color: optionalText(50),
});

/** PATCH /resident/vehicles/:id — owner-editable descriptive fields only. */
export const updateVehicleSchema = z.object({
  model: optionalText(100),
  color: optionalText(50),
});

/** PATCH /admin/vehicles/:id/approve */
export const approveVehicleSchema = z.object({
  status: z.enum(['ACTIVE', 'REJECTED']),
  parkingSlot: optionalText(50),
  stickerNumber: optionalText(50),
  rejectionNote: optionalText(500),
  reason: optionalText(500),
});

/** GET /admin/vehicles query */
export const listVehiclesQuerySchema = z.object({
  status: vehicleStatusEnum.optional(),
  vehicleType: z.string().max(30).optional(),
  flatId: z.string().max(64).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

/** Flatten a ZodError into the same 400 shape validate() middleware returns. */
export function zodErrorBody(error: z.ZodError) {
  return {
    success: false,
    message: 'Validation failed',
    errors: error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}
