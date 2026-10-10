import { z } from 'zod';

// Allow-lists for admin create/update of domestic staff. Unknown keys are
// stripped, so server-controlled fields (isVerified, qrToken, rating,
// totalReviews, addedById, societyId, verifiedBy, isCurrentlyWorking, ...)
// can never be set by a client.

const staffTypeEnum = z.enum([
  'MAID', 'COOK', 'NANNY', 'DRIVER', 'CLEANER', 'GARDENER', 'LAUNDRY', 'CARETAKER', 'SECURITY_GUARD', 'OTHER',
]);
export const staffAvailabilityEnum = z.enum(['AVAILABLE', 'BUSY', 'ON_LEAVE', 'INACTIVE']);

const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM');
const rate = z.number().nonnegative().max(10_000_000);

const staffFields = {
  name: z.string().trim().min(1).max(100),
  phone: z.string().min(10).max(20),
  email: z.string().email().max(255).optional(),
  // The apps send the S3 key from /upload (staff-photos/<uploaderId>/<file>); an https URL is also accepted.
  photoUrl: z
    .string()
    .max(2048)
    .refine(
      (v) => /^staff-photos\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(v) || /^https:\/\//.test(v),
      'photoUrl must be an uploaded staff photo key or an https URL'
    ),
  staffType: staffTypeEnum,
  experienceYears: z.number().int().min(0).max(80).optional(),
  description: z.string().max(2000).optional(),
  languages: z.array(z.string().max(50)).max(20).optional(),
  idProofType: z.string().max(50).optional(),
  idProofNumber: z.string().max(50).optional(),
  idProofUrl: z.string().url().max(2048).optional(),
  address: z.string().max(500).optional(),
  emergencyContact: z.string().max(100).optional(),
  isFullTime: z.boolean().optional(),
  workingDays: z.array(z.string().max(10)).max(7).optional(),
  workStartTime: timeString.optional(),
  workEndTime: timeString.optional(),
  hourlyRate: rate.optional(),
  dailyRate: rate.optional(),
  monthlyRate: rate.optional(),
};

export const createDomesticStaffSchema = z.object(staffFields);

export const updateDomesticStaffSchema = z.object({
  ...staffFields,
  availabilityStatus: staffAvailabilityEnum,
  isActive: z.boolean(),
}).partial();

export const staffAvailabilitySchema = z.object({ status: staffAvailabilityEnum });
