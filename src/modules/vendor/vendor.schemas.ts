import { z } from 'zod';

// Allow-lists for vendor writes. isVerified, verifiedAt, rating, totalReviews,
// likesCount, addedById and societyId are server-controlled and stripped.

const VENDOR_CATEGORIES = [
  'PLUMBER', 'ELECTRICIAN', 'CARPENTER', 'PAINTER', 'CLEANER', 'GARDENER',
  'PEST_CONTROL', 'APPLIANCE_REPAIR', 'OTHER',
] as const;

// Treat "" from form fields as "not provided"
const blankToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optStr = (max: number) => z.preprocess(blankToUndef, z.string().trim().max(max).optional());

const phone = z.string().trim().min(6).max(20).regex(/^[+\d][\d\s-]*$/, 'Invalid phone number');

const fields = {
  name: z.string().trim().min(1, 'Name is required').max(200),
  category: z.enum(VENDOR_CATEGORIES),
  phone,
  email: z.preprocess(blankToUndef, z.string().trim().email().max(320).optional()),
  alternatePhone: z.preprocess(blankToUndef, phone.optional()),
  companyName: optStr(200),
  description: optStr(2000),
  address: optStr(500),
  workingDays: z.array(z.string().trim().max(10)).max(7).optional(),
  workingHours: optStr(100),
  hourlyRate: z.number().nonnegative().max(1_000_000).optional(),
  minCharge: z.number().nonnegative().max(1_000_000).optional(),
  idProof: z.preprocess(blankToUndef, z.string().trim().min(1).max(2048).optional()),
  photos: z.array(z.string().trim().min(1).max(2048)).max(20).optional(),
};

export const createVendorSchema = z.object(fields);

export const updateVendorSchema = z.object({
  name: fields.name.optional(),
  category: fields.category.optional(),
  phone: fields.phone.optional(),
  email: fields.email,
  alternatePhone: fields.alternatePhone,
  companyName: fields.companyName,
  description: fields.description,
  address: fields.address,
  workingDays: fields.workingDays,
  workingHours: fields.workingHours,
  hourlyRate: fields.hourlyRate,
  minCharge: fields.minCharge,
  idProof: fields.idProof,
  photos: fields.photos,
  // Only honoured for admins (see service)
  isActive: z.boolean().optional(),
});

export const rateVendorSchema = z.object({
  rating: z.coerce.number().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
