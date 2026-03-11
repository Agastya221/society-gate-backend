import { z } from 'zod';

// IMP-1 + ARCH-1: Centralized Zod validation schemas for all API endpoints.
// Used with the validate() middleware in route files.

// ============================================
// COMMON SCHEMAS
// ============================================

const phoneSchema = z.string().regex(/^(\+91)?0?[6-9]\d{9}$/, 'Invalid phone number format');
const uuidSchema = z.string().uuid('Invalid ID format');
const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
const idParams = z.object({ id: uuidSchema });

// ============================================
// AUTH SCHEMAS
// ============================================

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const verifyOtpAndCreateProfileSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits'),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email().optional(),
});

// MSG91 Widget Token — shared for admin & guard verify (no user creation)
export const verifyWidgetTokenSchema = z.object({
  widgetToken: z.string().min(1, 'Widget token is required'),
});

// MSG91 Widget Token — resident verify (creates new user if first login)
export const verifyResidentWidgetTokenSchema = z.object({
  widgetToken: z.string().min(1, 'Widget token is required'),
  name: z.string().min(1, 'Name is required').max(100).optional(),
  email: z.string().email().optional(),
});

export const loginSchema = z.object({
  phone: phoneSchema.optional(),
  email: z.string().email().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.phone || data.email, {
  message: 'Either phone or email is required',
});

export const guardLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const resetPasswordSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
});

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createGuardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: phoneSchema,
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
});

// ============================================
// ENTRY REQUEST SCHEMAS
// ============================================

const entryTypeEnum = z.enum(['VISITOR', 'DELIVERY', 'DOMESTIC_STAFF', 'CAB', 'VENDOR']);
const providerTagEnum = z.enum(['BLINKIT', 'SWIGGY', 'ZOMATO', 'AMAZON', 'FLIPKART', 'BIGBASKET', 'DUNZO', 'OTHER']);
const entryRequestStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']);

export const createEntryRequestSchema = z.object({
  type: entryTypeEnum,
  flatId: uuidSchema,
  visitorName: z.string().max(100).optional(),
  visitorPhone: phoneSchema.optional(),
  providerTag: providerTagEnum.optional(),
  photoKey: z.string().optional(),
});

export const entryRequestQuerySchema = paginationQuery.extend({
  status: entryRequestStatusEnum.optional(),
  flatId: uuidSchema.optional(),
});

// ============================================
// EMERGENCY SCHEMAS
// ============================================

const emergencyTypeEnum = z.enum(['MEDICAL', 'FIRE', 'THEFT', 'VIOLENCE', 'ACCIDENT', 'OTHER']);

export const createEmergencySchema = z.object({
  societyId: uuidSchema,
  flatId: uuidSchema.optional(),
  type: emergencyTypeEnum,
  description: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
});

export const resolveEmergencySchema = z.object({
  notes: z.string().max(1000).optional(),
});

// ============================================
// COMPLAINT SCHEMAS
// ============================================

const complaintCategoryEnum = z.enum(['MAINTENANCE', 'SECURITY', 'CLEANLINESS', 'WATER', 'ELECTRICITY', 'PARKING', 'PLUMBING', 'NOISE', 'PETS', 'OTHER']);
const complaintStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED']);
const complaintPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createComplaintSchema = z.object({
  category: complaintCategoryEnum,
  priority: complaintPriorityEnum.optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  images: z.array(z.string()).max(5).optional(),
  location: z.string().max(200).optional(),
  isAnonymous: z.boolean().optional(),
});

export const updateComplaintStatusSchema = z.object({
  status: complaintStatusEnum,
});

export const assignComplaintSchema = z.object({
  assignedToId: uuidSchema,
});

export const resolveComplaintSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required').max(2000),
});

// ============================================
// NOTICE SCHEMAS
// ============================================

const noticeTypeEnum = z.enum(['GENERAL', 'URGENT', 'EVENT', 'MAINTENANCE', 'MEETING', 'EMERGENCY']);
const noticePriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const createNoticeSchema = z.object({
  type: noticeTypeEnum,
  priority: noticePriorityEnum.optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  images: z.array(z.string()).optional(),
  documents: z.array(z.string()).optional(),
  isUrgent: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateNoticeSchema = z.object({
  type: noticeTypeEnum.optional(),
  priority: noticePriorityEnum.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  images: z.array(z.string()).optional(),
  documents: z.array(z.string()).optional(),
  isUrgent: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// AMENITY SCHEMAS
// ============================================

const amenityTypeEnum = z.enum(['CLUBHOUSE', 'GYM', 'SWIMMING_POOL', 'PARTY_HALL', 'SPORTS_COURT', 'BANQUET_HALL', 'GARDEN', 'OTHER']);
const timeFormatSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)');

export const createAmenitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: amenityTypeEnum,
  description: z.string().max(1000).optional(),
  capacity: z.number().int().positive().optional(),
  openTime: timeFormatSchema.optional(),
  closeTime: timeFormatSchema.optional(),
  bookingDuration: z.number().int().positive().optional(),
  advanceBookingDays: z.number().int().positive().optional(),
  maxBookingsPerUser: z.number().int().positive().optional(),
  pricePerHour: z.number().nonnegative().optional(),
  images: z.array(z.string()).optional(),
});

export const createBookingSchema = z.object({
  amenityId: uuidSchema,
  flatId: uuidSchema,
  bookingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  startTime: timeFormatSchema,
  endTime: timeFormatSchema,
  guestCount: z.number().int().nonnegative().optional(),
  purpose: z.string().max(200).optional(),
});

// ============================================
// GATE PASS SCHEMAS
// ============================================

const gatePassTypeEnum = z.enum(['MATERIAL', 'VEHICLE', 'MOVE_IN', 'MOVE_OUT', 'MAINTENANCE']);

export const createGatePassSchema = z.object({
  flatId: uuidSchema,
  type: gatePassTypeEnum,
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  vehicleNumber: z.string().max(20).optional(),
  driverName: z.string().max(100).optional(),
  driverPhone: phoneSchema.optional(),
  itemsList: z.array(z.string()).optional(),
  workerName: z.string().max(100).optional(),
  workerPhone: phoneSchema.optional(),
  companyName: z.string().max(100).optional(),
  attachments: z.array(z.string()).optional(),
});

// ============================================
// DOMESTIC STAFF SCHEMAS
// ============================================

const domesticStaffTypeEnum = z.enum(['MAID', 'COOK', 'NANNY', 'DRIVER', 'CLEANER', 'GARDENER', 'LAUNDRY', 'CARETAKER', 'SECURITY_GUARD', 'OTHER']);

export const createStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: phoneSchema,
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
  staffType: domesticStaffTypeEnum,
  experienceYears: z.number().int().nonnegative().optional(),
  description: z.string().max(500).optional(),
  languages: z.array(z.string()).optional(),
  idProofType: z.string().max(50).optional(),
  idProofNumber: z.string().max(50).optional(),
  idProofUrl: z.string().optional(),
  address: z.string().max(300).optional(),
  emergencyContact: phoneSchema.optional(),
  isFullTime: z.boolean().optional(),
  workingDays: z.array(z.string()).optional(),
  workStartTime: timeFormatSchema.optional(),
  workEndTime: timeFormatSchema.optional(),
  hourlyRate: z.number().nonnegative().optional(),
  dailyRate: z.number().nonnegative().optional(),
  monthlyRate: z.number().nonnegative().optional(),
});

export const staffCheckInSchema = z.object({
  domesticStaffId: uuidSchema,
  flatId: uuidSchema,
  societyId: uuidSchema,
  checkInMethod: z.string().max(50).optional(),
});

export const staffCheckOutSchema = z.object({
  workCompleted: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export const createStaffBookingSchema = z.object({
  domesticStaffId: uuidSchema,
  flatId: uuidSchema,
  societyId: uuidSchema,
  bookingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  startTime: timeFormatSchema,
  endTime: timeFormatSchema,
  durationHours: z.number().positive(),
  workType: z.string().min(1).max(100),
  requirements: z.string().max(500).optional(),
  estimatedCost: z.number().nonnegative().optional(),
});

export const createStaffReviewSchema = z.object({
  domesticStaffId: uuidSchema,
  flatId: uuidSchema,
  rating: z.number().min(1).max(5),
  review: z.string().max(1000).optional(),
  workQuality: z.number().min(1).max(5).optional(),
  punctuality: z.number().min(1).max(5).optional(),
  behavior: z.number().min(1).max(5).optional(),
  workType: z.string().max(100).optional(),
  workDate: z.string().datetime().optional(),
});

export const createStaffAssignmentSchema = z.object({
  domesticStaffId: uuidSchema,
  flatId: uuidSchema,
  isPrimary: z.boolean().optional(),
  workingDays: z.array(z.string()).optional(),
  workStartTime: timeFormatSchema.optional(),
  workEndTime: timeFormatSchema.optional(),
  agreedRate: z.number().nonnegative().optional(),
  rateType: z.string().max(20).optional(),
});

// ============================================
// VENDOR SCHEMAS
// ============================================

const vendorCategoryEnum = z.enum(['PLUMBER', 'ELECTRICIAN', 'CARPENTER', 'PAINTER', 'CLEANER', 'GARDENER', 'PEST_CONTROL', 'APPLIANCE_REPAIR', 'OTHER']);

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: vendorCategoryEnum,
  phone: phoneSchema,
  email: z.string().email().optional(),
  alternatePhone: phoneSchema.optional(),
  companyName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  address: z.string().max(300).optional(),
  workingDays: z.array(z.string()).optional(),
  workingHours: z.string().max(50).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  minCharge: z.number().nonnegative().optional(),
  idProof: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

// ============================================
// PRE-APPROVAL SCHEMAS
// ============================================

const visitorTypeEnum = z.enum(['GUEST', 'DELIVERY_PERSON', 'CAB_DRIVER', 'SERVICE_PROVIDER', 'OTHER', 'FAMILY_MEMBER', 'FRIEND']);

export const createPreApprovalSchema = z.object({
  flatId: uuidSchema,
  visitorName: z.string().min(1, 'Visitor name is required').max(100),
  visitorPhone: phoneSchema,
  visitorType: visitorTypeEnum.optional(),
  purpose: z.string().max(200).optional(),
  vehicleNumber: z.string().max(20).optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  maxUses: z.number().int().positive().optional(),
});

// ============================================
// ONBOARDING SCHEMAS
// ============================================

const residentTypeEnum = z.enum(['OWNER', 'TENANT']);

export const createOnboardingSchema = z.object({
  societyId: uuidSchema,
  blockId: uuidSchema,
  flatId: uuidSchema,
  residentType: residentTypeEnum,
});

// ============================================
// SOCIETY SCHEMAS
// ============================================

export const createSocietySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  contactName: z.string().min(1).max(100),
  contactPhone: phoneSchema,
  contactEmail: z.string().email().optional(),
  totalFlats: z.number().int().positive().optional(),
  monthlyFee: z.number().nonnegative().optional(),
});

// ============================================
// UPLOAD SCHEMAS
// ============================================

export const presignedUrlSchema = z.object({
  context: z.string().min(1).max(50),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().regex(/^[\w-]+\/[\w.+-]+$/, 'Invalid MIME type'),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  documentType: z.string().max(50).optional(),
});

// ============================================
// FAMILY SCHEMAS
// ============================================

const familyRoleEnum = z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER']);

export const addFamilyMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: phoneSchema,
  email: z.string().email().optional(),
  familyRole: familyRoleEnum,
});

// ============================================
// SHARED EXPORTS
// ============================================

export { idParams, paginationQuery, uuidSchema, phoneSchema };
