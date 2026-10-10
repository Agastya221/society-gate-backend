import { z } from 'zod';
import { AppError } from '../../utils/ResponseHandler';

// ============================================
// SOCIETY MODULE SCHEMAS (/api/v1/admin/societies)
// Strict allow-lists of plain scalar fields. Relations, ids, timestamps and
// anything billing/status related are never accepted from an ADMIN.
// ============================================

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const phone = z.string().trim().regex(/^(\+91)?0?[6-9]\d{9}$/, 'Invalid phone number format');

// Fields a society ADMIN may edit on their own society (profile, contact, bank/legal).
const adminEditableShape = {
  name: trimmed(200).optional(),
  registeredName: optionalText(200),
  registrationNumber: optionalText(100),
  address: trimmed(500).optional(),
  city: trimmed(100).optional(),
  state: trimmed(100).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  logoUrl: z.string().trim().url().max(2048).nullable().optional(),
  contactName: trimmed(120).optional(),
  contactPhone: phone.optional(),
  contactEmail: z.string().trim().email().max(254).nullable().optional(),
  bankAccountNumber: optionalText(34),
  bankIfsc: optionalText(11),
  bankBranchName: optionalText(200),
  panNumber: optionalText(10),
  gstin: optionalText(15),
  maintenanceBillingType: z.enum(['FLAT', 'SQUARE_FOOT', 'CUSTOM']).optional(),
};

export const adminUpdateSocietySchema = z.object(adminEditableShape).strict();

// SUPER_ADMIN may additionally manage platform-controlled fields.
export const superAdminUpdateSocietySchema = z
  .object({
    ...adminEditableShape,
    logoKey: optionalText(1024),
    maintenanceBillingConfig: z.record(z.string(), z.unknown()).optional(),
    totalFlats: z.number().int().min(0).max(100000).optional(),
    isActive: z.boolean().optional(),
    onboardingStatus: z
      .enum([
        'LEAD',
        'PROFILE_CREATED',
        'DOCS_PENDING',
        'PENDING_VERIFICATION',
        'VERIFIED',
        'IMPORT_PENDING',
        'CONFIG_PENDING',
        'ACTIVE',
        'REJECTED',
      ])
      .optional(),
    monthlyFee: z.number().min(0).max(10_000_000).optional(),
    subscriptionCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
    lastPaidDate: z.coerce.date().nullable().optional(),
    nextDueDate: z.coerce.date().optional(),
    paymentStatus: z.enum(['PENDING', 'PAID', 'OVERDUE']).optional(),
  })
  .strict();

// POST /admin/societies (SUPER_ADMIN). Unknown keys are stripped, never forwarded.
export const createSocietySchema = z.object({
  name: trimmed(200),
  registeredName: optionalText(200),
  registrationNumber: optionalText(100),
  address: trimmed(500),
  city: trimmed(100),
  state: trimmed(100),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  logoUrl: z.string().trim().url().max(2048).nullable().optional(),
  logoKey: optionalText(1024),
  contactName: trimmed(120),
  contactPhone: phone,
  contactEmail: z.string().trim().email().max(254).nullable().optional(),
  bankAccountNumber: optionalText(34),
  bankIfsc: optionalText(11),
  bankBranchName: optionalText(200),
  panNumber: optionalText(10),
  gstin: optionalText(15),
  maintenanceBillingType: z.enum(['FLAT', 'SQUARE_FOOT', 'CUSTOM']).optional(),
  totalFlats: z.number().int().min(0).max(100000).optional(),
  monthlyFee: z.number().min(0).max(10_000_000).optional(),
  subscriptionCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
});

export const createBlockSchema = z.object({
  name: z.string().trim().min(1, 'Block name is required').max(100),
  totalFloors: z.number().int().min(0).max(500).optional(),
  description: z.string().trim().max(500).optional(),
});

export const createFlatSchema = z.object({
  blockName: z.string().trim().min(1, 'Block name is required').max(100),
  flatNumber: z.string().trim().min(1, 'Flat number is required').max(50),
  floor: z.string().trim().max(20).optional(),
  ownerName: z.string().trim().max(120).optional(),
  ownerPhone: z.string().trim().max(20).optional(),
  ownerEmail: z.string().trim().max(254).optional(),
});

export const updateFlatSchema = z.object({
  blockName: z.string().trim().min(1).max(100).optional(),
  flatNumber: z.string().trim().min(1).max(50).optional(),
  floor: z.string().trim().max(20).optional(),
  ownerName: z.string().trim().max(120).optional(),
  ownerPhone: z.string().trim().max(20).optional(),
  ownerEmail: z.string().trim().max(254).optional(),
  isActive: z.boolean().optional(),
});

export const listSocietiesQuerySchema = z.object({
  city: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.unknown().optional(),
  limit: z.unknown().optional(),
});

/** Parse with a Zod schema and turn validation failures into a 400 AppError. */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join(', ');
    throw new AppError(message || 'Invalid request', 400);
  }
  return result.data;
}
