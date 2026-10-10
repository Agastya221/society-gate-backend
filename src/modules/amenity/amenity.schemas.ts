import { z } from 'zod';

// Phase 2: allow-lists for amenity/booking writes. Unknown keys are stripped,
// so societyId, amount, isPaid, status, userId etc. can never come from the client.

const amenityTypeEnum = z.enum([
  'CLUBHOUSE', 'GYM', 'SWIMMING_POOL', 'PARTY_HALL', 'SPORTS_COURT', 'BANQUET_HALL', 'GARDEN', 'OTHER',
]);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM');

// The app sends rules as one string; the column is string[].
const rules = z.preprocess(
  (v) => (typeof v === 'string' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : v),
  z.array(z.string().trim().min(1).max(300)).max(50)
);

const amenityFields = {
  name: z.string().trim().min(1).max(100),
  type: amenityTypeEnum,
  description: z.string().trim().max(1000).optional(),
  capacity: z.coerce.number().int().min(1).max(10000).optional(),
  openTime: hhmm.optional(),
  closeTime: hhmm.optional(),
  timings: z.string().trim().max(100).optional(),
  slotDurationHours: z.coerce.number().int().min(1).max(24).optional(),
  rules: rules.optional(),
  bookingDuration: z.coerce.number().int().min(15).max(1440).optional(),
  advanceBookingDays: z.coerce.number().int().min(0).max(365).optional(),
  maxBookingsPerUser: z.coerce.number().int().min(1).max(100).optional(),
  pricePerHour: z.coerce.number().min(0).max(1_000_000).optional(),
  images: z.array(z.string().max(1024)).max(10).optional(),
};

export const createAmenitySchema = z.object(amenityFields);

export const updateAmenitySchema = z
  .object({ ...amenityFields, isActive: z.boolean().optional() })
  .partial();

export const createBookingSchema = z.object({
  amenityId: z.string().uuid(),
  // Only honoured for admins; residents always book for their own flat.
  flatId: z.string().uuid().optional(),
  bookingDate: z.coerce.date(),
  startTime: hhmm,
  endTime: hhmm,
  guestCount: z.coerce.number().int().min(1).max(1000).optional(),
  purpose: z.string().trim().max(300).optional(),
});

export const bookSlotSchema = z.object({
  slotId: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  members: z.array(z.string().max(64)).max(50).optional(),
  purpose: z.string().trim().max(300).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
