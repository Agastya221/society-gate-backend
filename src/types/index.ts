/**
 * Type definitions for Society Gate Backend
 * This file provides type safety across the application
 */

import {
  Role,
  EntryType,
  EntryStatus,
  VisitorType,
  PreApprovalStatus,
  PaymentStatus,
  FamilyRole,
  GatePassType,
  GatePassStatus,
  NoticeType,
  NoticePriority,
  AmenityType,
  BookingStatus,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintPriority,
  EmergencyType,
  EmergencyStatus,
  VendorCategory,
  OnboardingStatus,
  ResidentType,
  DocumentType,
  NotificationType,
  EntryRequestStatus,
  ProviderTag,
  DomesticStaffType,
  StaffAvailabilityStatus,
  StaffBookingStatus,
} from '../../prisma/generated/prisma/client';

import type {
  User,
  Flat,
  Society,
  Block,
  Entry,
  EntryRequest,
  PreApproval,
  GatePass,
  Notice,
  Amenity,
  AmenityBooking,
  Complaint,
  Emergency,
  Vendor,
  DomesticStaff,
  StaffFlatAssignment,
  StaffAttendance,
  StaffBooking,
  StaffReview,
  ExpectedDelivery,
  DeliveryAutoApproveRule,
  OnboardingRequest,
  ResidentDocument,
  Notification,
  Prisma,
} from '../../prisma/generated/prisma/client';

// Re-export enums for convenience
export {
  Role,
  EntryType,
  EntryStatus,
  VisitorType,
  PreApprovalStatus,
  PaymentStatus,
  FamilyRole,
  GatePassType,
  GatePassStatus,
  NoticeType,
  NoticePriority,
  AmenityType,
  BookingStatus,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintPriority,
  EmergencyType,
  EmergencyStatus,
  VendorCategory,
  OnboardingStatus,
  ResidentType,
  DocumentType,
  NotificationType,
  EntryRequestStatus,
  ProviderTag,
  DomesticStaffType,
  StaffAvailabilityStatus,
  StaffBookingStatus,
};

// Re-export model types and Prisma namespace
export type {
  User,
  Flat,
  Society,
  Block,
  Entry,
  EntryRequest,
  PreApproval,
  GatePass,
  Notice,
  Amenity,
  AmenityBooking,
  Complaint,
  Emergency,
  Vendor,
  DomesticStaff,
  StaffFlatAssignment,
  StaffAttendance,
  StaffBooking,
  StaffReview,
  ExpectedDelivery,
  DeliveryAutoApproveRule,
  OnboardingRequest,
  ResidentDocument,
  Notification,
  Prisma,
};

// ============================================
// AUTH & USER TYPES
// ============================================

export interface AuthenticatedUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  photoUrl: string | null;
  isActive: boolean;
  flatId: string | null;
  flat: Flat | null;
  societyId: string | null;
  society: Society | null;
  isOwner: boolean;
  isPrimaryResident: boolean;
  familyRole: FamilyRole | null;
  primaryResidentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  userId: string;
  role: Role;
  societyId: string | null;
  flatId: string | null;
  appType: 'RESIDENT_APP' | 'GUARD_APP';
  type?: 'access' | 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}

// ============================================
// PAGINATION
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ============================================
// NOTICE TYPES
// ============================================

export interface CreateNoticeDTO {
  societyId: string;
  type: NoticeType;
  priority?: NoticePriority;
  title: string;
  description: string;
  images?: string[];
  documents?: string[];
  isUrgent?: boolean;
  isPinned?: boolean;
  publishAt?: Date;
  expiresAt?: Date;
}

export interface UpdateNoticeDTO {
  type?: NoticeType;
  priority?: NoticePriority;
  title?: string;
  description?: string;
  images?: string[];
  documents?: string[];
  isUrgent?: boolean;
  isPinned?: boolean;
  publishAt?: Date;
  expiresAt?: Date;
  isActive?: boolean;
}

export interface NoticeFilters extends PaginationParams {
  societyId: string;
  type?: NoticeType;
  priority?: NoticePriority;
  isActive?: boolean;
  isPinned?: boolean;
}

// ============================================
// AMENITY TYPES
// ============================================

export interface CreateAmenityDTO {
  societyId: string;
  name: string;
  type: AmenityType;
  description?: string;
  capacity?: number;
  openTime?: string;
  closeTime?: string;
  bookingDuration?: number;
  advanceBookingDays?: number;
  maxBookingsPerUser?: number;
  pricePerHour?: number;
  images?: string[];
}

export interface UpdateAmenityDTO {
  name?: string;
  type?: AmenityType;
  description?: string;
  capacity?: number;
  openTime?: string;
  closeTime?: string;
  bookingDuration?: number;
  advanceBookingDays?: number;
  maxBookingsPerUser?: number;
  pricePerHour?: number;
  images?: string[];
  isActive?: boolean;
}

export interface AmenityFilters extends PaginationParams {
  societyId: string;
  type?: AmenityType;
  isActive?: boolean;
}

export interface CreateBookingDTO {
  amenityId: string;
  flatId: string;
  societyId: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  guestCount?: number;
  purpose?: string;
}

export interface BookingFilters extends PaginationParams {
  societyId: string;
  amenityId?: string;
  userId?: string;
  flatId?: string;
  status?: BookingStatus;
  bookingDate?: string | Date;
  fromDate?: Date;
  toDate?: Date;
}

// ============================================
// COMPLAINT TYPES
// ============================================

export interface CreateComplaintDTO {
  societyId: string;
  flatId?: string;
  category: ComplaintCategory;
  priority?: ComplaintPriority;
  title: string;
  description: string;
  images?: string[];
  location?: string;
  isAnonymous?: boolean;
}

export interface UpdateComplaintStatusDTO {
  status: ComplaintStatus;
}

export interface AssignComplaintDTO {
  assignedToId: string;
}

export interface ResolveComplaintDTO {
  resolution: string;
}

export interface ComplaintFilters extends PaginationParams {
  societyId: string;
  flatId?: string;
  reportedById?: string;
  assignedToId?: string;
  category?: ComplaintCategory;
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
}

// ============================================
// EMERGENCY TYPES
// ============================================

export interface CreateEmergencyDTO {
  societyId: string;
  flatId?: string;
  type: EmergencyType;
  description?: string;
  location?: string;
}

export interface EmergencyFilters extends PaginationParams {
  societyId: string;
  status?: EmergencyStatus;
  type?: EmergencyType;
  reportedById?: string;
}

// ============================================
// VENDOR TYPES
// ============================================

export interface CreateVendorDTO {
  societyId: string;
  name: string;
  category: VendorCategory;
  phone: string;
  email?: string;
  alternatePhone?: string;
  companyName?: string;
  description?: string;
  address?: string;
  workingDays?: string[];
  workingHours?: string;
  hourlyRate?: number;
  minCharge?: number;
  idProof?: string;
  photos?: string[];
}

export interface UpdateVendorDTO {
  name?: string;
  category?: VendorCategory;
  phone?: string;
  email?: string;
  alternatePhone?: string;
  companyName?: string;
  description?: string;
  address?: string;
  workingDays?: string[];
  workingHours?: string;
  hourlyRate?: number;
  minCharge?: number;
  idProof?: string;
  photos?: string[];
  isActive?: boolean;
}

export interface VendorFilters extends PaginationParams {
  societyId: string;
  category?: VendorCategory;
  isVerified?: boolean;
  isActive?: boolean;
}

// ============================================
// GATE PASS TYPES
// ============================================

export interface CreateGatePassDTO {
  societyId: string;
  flatId: string;
  type: GatePassType;
  title: string;
  description?: string;
  validFrom: Date;
  validUntil: Date;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  itemsList?: string[];
  workerName?: string;
  workerPhone?: string;
  companyName?: string;
  attachments?: string[];
}

export interface GatePassFilters extends PaginationParams {
  societyId: string;
  flatId?: string;
  type?: GatePassType;
  status?: GatePassStatus;
}

// ============================================
// PRE-APPROVAL & ENTRY TYPES
// ============================================

export interface CreatePreApprovalDTO {
  societyId?: string;
  flatId: string;
  visitorName: string;
  visitorPhone: string;
  visitorType?: VisitorType;
  purpose?: string;
  vehicleNumber?: string;
  validFrom: Date;
  validUntil: Date;
  maxUses?: number;
}

export interface PreApprovalFilters {
  status?: PreApprovalStatus;
}

export interface EntryFilters extends PaginationParams {
  societyId: string;
  flatId?: string;
  type?: EntryType;
  status?: EntryStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface CreateEntryRequestDTO {
  societyId: string;
  flatId: string;
  type: EntryType;
  visitorName?: string;
  visitorPhone?: string;
  providerTag?: ProviderTag;
  photoKey?: string;
}

export interface EntryRequestFilters extends PaginationParams {
  societyId?: string;
  flatId?: string;
  status?: EntryRequestStatus;
  guardId?: string;
}

// ============================================
// DELIVERY TYPES
// ============================================

export interface CreateExpectedDeliveryDTO {
  flatId: string;
  societyId: string;
  companyName: string;
  itemName?: string;
  expectedDate: Date;
  timeFrom?: string;
  timeUntil?: string;
  autoApprove?: boolean;
}

export interface CreateAutoApproveRuleDTO {
  flatId: string;
  societyId: string;
  companies: string[];
  allowedDays?: string[];
  timeFrom?: string;
  timeUntil?: string;
}

// ============================================
// DOMESTIC STAFF TYPES
// ============================================

export interface CreateStaffDTO {
  societyId: string;
  flatId?: string;
  name: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  staffType: DomesticStaffType;
  experienceYears?: number;
  description?: string;
  languages?: string[];
  idProofType?: string;
  idProofNumber?: string;
  idProofUrl?: string;
  address?: string;
  emergencyContact?: string;
  isFullTime?: boolean;
  workingDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
}

export interface UpdateStaffDTO {
  name?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  staffType?: DomesticStaffType;
  experienceYears?: number;
  description?: string;
  languages?: string[];
  idProofType?: string;
  idProofNumber?: string;
  idProofUrl?: string;
  address?: string;
  emergencyContact?: string;
  isFullTime?: boolean;
  workingDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
  availabilityStatus?: StaffAvailabilityStatus;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  isActive?: boolean;
}

export interface StaffFilters extends PaginationParams {
  societyId: string;
  flatId?: string;
  staffType?: DomesticStaffType;
  availabilityStatus?: StaffAvailabilityStatus;
  isVerified?: boolean;
  isActive?: boolean;
}

export interface CreateStaffAssignmentDTO {
  domesticStaffId: string;
  flatId: string;
  isPrimary?: boolean;
  workingDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
  agreedRate?: number;
  rateType?: string;
}

export interface UpdateStaffAssignmentDTO {
  isPrimary?: boolean;
  workingDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
  agreedRate?: number;
  rateType?: string;
  isActive?: boolean;
}

export interface StaffCheckInDTO {
  domesticStaffId: string;
  flatId: string;
  societyId: string;
  checkInMethod?: string;
}

export interface StaffCheckOutDTO {
  workCompleted?: string;
  notes?: string;
}

export interface AttendanceFilters extends PaginationParams {
  societyId?: string;
  flatId?: string;
  domesticStaffId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface CreateStaffBookingDTO {
  domesticStaffId: string;
  flatId: string;
  societyId: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  durationHours: number;
  workType: string;
  requirements?: string;
  estimatedCost?: number;
}

export interface StaffBookingFilters extends PaginationParams {
  societyId?: string;
  flatId?: string;
  domesticStaffId?: string;
  bookedById?: string;
  status?: StaffBookingStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface CreateStaffReviewDTO {
  domesticStaffId: string;
  flatId: string;
  rating: number;
  review?: string;
  workQuality?: number;
  punctuality?: number;
  behavior?: number;
  workType?: string;
  workDate?: Date;
}

// ============================================
// SOCIETY TYPES
// ============================================

export interface CreateSocietyDTO {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  totalFlats?: number;
  monthlyFee?: number;
}

export interface UpdateSocietyDTO {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  totalFlats?: number;
  monthlyFee?: number;
  isActive?: boolean;
}

export interface SocietyFilters extends PaginationParams {
  city?: string;
  isActive?: boolean;
  paymentStatus?: PaymentStatus;
}

// ============================================
// ONBOARDING TYPES
// ============================================

export interface CreateOnboardingRequestDTO {
  societyId: string;
  blockId: string;
  flatId: string;
  residentType: ResidentType;
}

export interface OnboardingFilters extends PaginationParams {
  societyId?: string;
  status?: OnboardingStatus;
  residentType?: ResidentType;
  flatId?: string;
}

export interface UploadDocumentDTO {
  documentType: DocumentType;
  s3Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export interface CreateNotificationDTO {
  userId: string;
  societyId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  referenceId?: string;
  referenceType?: string;
}

export interface NotificationFilters extends PaginationParams {
  userId: string;
  isRead?: boolean;
  type?: NotificationType;
}

// ============================================
// UPLOAD TYPES
// ============================================

export interface PresignedUrlRequest {
  context: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType?: string;
}

export interface ConfirmUploadRequest {
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  onboardingRequestId?: string;
}

// ============================================
// REPORTS TYPES
// ============================================

export interface DashboardStats {
  totalResidents: number;
  totalFlats: number;
  totalEntriesToday: number;
  pendingApprovals: number;
  activeEmergencies: number;
  openComplaints: number;
}

export interface EntryStats {
  byDate: Record<string, number>;
  byType: Record<EntryType, number>;
  byStatus: Record<EntryStatus, number>;
  total: number;
}

export interface PeakHoursAnalysis {
  hourlyData: Record<number, number>;
  peakHours: Array<[number, number]>;
  busiestDay: string;
}

export interface DeliveryPatterns {
  byCompany: Record<string, number>;
  topCompanies: Array<[string, number]>;
  averagePerDay: number;
}

export interface ComplaintStats {
  byCategory: Record<ComplaintCategory, number>;
  byStatus: Record<ComplaintStatus, number>;
  byPriority: Record<ComplaintPriority, number>;
  averageResolutionTime: number;
  total: number;
}

export interface VisitorFrequencyReport {
  frequentVisitors: Array<{
    visitorPhone: string;
    visitorName: string;
    visitCount: number;
    lastVisit: Date;
  }>;
  totalUniqueVisitors: number;
}

export interface HealthScore {
  overall: number;
  security: number;
  maintenance: number;
  community: number;
  factors: Record<string, number>;
}

// ============================================
// ERROR TYPES
// ============================================

export interface ApiError {
  success: false;
  message: string;
  error?: {
    code?: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================
// SOCKET TYPES
// ============================================

export interface SocketEventData {
  [key: string]: unknown;
}

// ============================================
// CACHE TYPES
// ============================================

export interface CacheOptions {
  ttl: number;
  keyPrefix: string;
  varyBy?: string[];
}

// ============================================
// GENERIC FILTER WHERE CLAUSE TYPE
// ============================================

export interface WhereClause {
  societyId?: string;
  flatId?: string;
  userId?: string;
  status?: string;
  type?: string;
  category?: string;
  isActive?: boolean;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  [key: string]: unknown;
}
