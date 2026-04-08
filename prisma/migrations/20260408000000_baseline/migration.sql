-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'GUARD', 'RESIDENT');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('VISITOR', 'DELIVERY', 'DOMESTIC_STAFF', 'CAB', 'VENDOR');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'CHECKED_OUT');

-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('GUEST', 'DELIVERY_PERSON', 'CAB_DRIVER', 'SERVICE_PROVIDER', 'OTHER', 'FAMILY_MEMBER', 'FRIEND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "GatePassType" AS ENUM ('MATERIAL', 'VEHICLE', 'MOVE_IN', 'MOVE_OUT', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('GENERAL', 'URGENT', 'EVENT', 'MAINTENANCE', 'MEETING', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "NoticePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AmenityType" AS ENUM ('CLUBHOUSE', 'GYM', 'SWIMMING_POOL', 'PARTY_HALL', 'SPORTS_COURT', 'BANQUET_HALL', 'GARDEN', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('MAINTENANCE', 'SECURITY', 'CLEANLINESS', 'WATER', 'ELECTRICITY', 'PARKING', 'PLUMBING', 'NOISE', 'PETS', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('MEDICAL', 'FIRE', 'SECURITY', 'LIFT_STUCK', 'ANIMAL_THREAT', 'THEFT', 'VIOLENCE', 'ACCIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'FALSE_ALARM');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('PLUMBER', 'ELECTRICIAN', 'CARPENTER', 'PAINTER', 'CLEANER', 'GARDENER', 'PEST_CONTROL', 'APPLIANCE_REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "SocietyRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'PENDING_DOCS', 'PENDING_APPROVAL', 'RESUBMIT_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResidentType" AS ENUM ('OWNER', 'TENANT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OWNERSHIP_PROOF', 'TENANT_AGREEMENT', 'AADHAR_CARD', 'PAN_CARD', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingAction" AS ENUM ('CREATED', 'SOCIETY_SELECTED', 'FLAT_SELECTED', 'DOCUMENTS_UPLOADED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUESTED', 'DOCUMENTS_RESUBMITTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ONBOARDING_STATUS', 'ENTRY_REQUEST', 'DELIVERY_REQUEST', 'EMERGENCY_ALERT', 'STAFF_CHECKIN', 'STAFF_CHECKOUT', 'GUEST_ENTRY', 'PARKING_VIOLATION', 'PARKING_COMPLAINT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('WRONG_PARKING', 'DOUBLE_PARKING', 'BLOCKING_GATE', 'UNAUTHORIZED_SPOT', 'NO_STICKER', 'OTHER');

-- CreateEnum
CREATE TYPE "ViolationSource" AS ENUM ('OFFICIAL', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('OPEN', 'NOTIFIED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EntryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProviderTag" AS ENUM ('BLINKIT', 'SWIGGY', 'ZOMATO', 'AMAZON', 'FLIPKART', 'BIGBASKET', 'DUNZO', 'OTHER');

-- CreateEnum
CREATE TYPE "GuestInviteType" AS ENUM ('QUICK', 'FREQUENT', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GuestInviteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PartyInviteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuestEntryResult" AS ENUM ('ALLOWED', 'DENIED', 'OUTSIDE_WINDOW');

-- CreateEnum
CREATE TYPE "InviteRefType" AS ENUM ('GUEST_INVITE', 'PARTY_INVITE');

-- CreateEnum
CREATE TYPE "DomesticStaffType" AS ENUM ('MAID', 'COOK', 'NANNY', 'DRIVER', 'CLEANER', 'GARDENER', 'LAUNDRY', 'CARETAKER', 'SECURITY_GUARD', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffAvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StaffBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PreApprovedEntryType" AS ENUM ('CAB', 'DELIVERY', 'HELP');

-- CreateEnum
CREATE TYPE "PreApprovedEntryMode" AS ENUM ('SAFE', 'NORMAL', 'SURPRISE');

-- CreateEnum
CREATE TYPE "PreApprovedScheduleType" AS ENUM ('ONCE', 'RECURRING');

-- CreateEnum
CREATE TYPE "PreApprovedEntryStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "PreApprovedVerificationType" AS ENUM ('NONE', 'VEHICLE_LAST4', 'OTP', 'QR');

-- CreateEnum
CREATE TYPE "HelpCategory" AS ENUM ('PLUMBER', 'ELECTRICIAN', 'CARPENTER', 'PAINTER', 'TUTOR', 'BEAUTICIAN', 'FITNESS_TRAINER', 'PHYSIOTHERAPIST', 'COOK', 'PEST_CONTROL', 'APPLIANCE_REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "PostCategory" AS ENUM ('GENERAL', 'ANNOUNCEMENT', 'QUESTION', 'ISSUE', 'APPRECIATION', 'HELP', 'EVENT', 'MAINTENANCE', 'LOST_FOUND', 'SAFETY', 'FOR_SALE');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('RULES_AND_BYLAWS', 'MEETING_MINUTES', 'FINANCIAL', 'CIRCULAR', 'MAINTENANCE', 'LEGAL', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "Society" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "totalFlats" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "subscriptionCycle" "SubscriptionCycle" NOT NULL DEFAULT 'MONTHLY',
    "lastPaidDate" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Society_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "penalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocietyRegistrationRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requestedById" TEXT NOT NULL,
    "societyName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "totalFlats" INTEGER,
    "monthlyFee" DOUBLE PRECISION,
    "status" "SocietyRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "societyId" TEXT,

    CONSTRAINT "SocietyRegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatePoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "totalFloors" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flat" (
    "id" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "floor" TEXT,
    "blockId" TEXT,
    "societyId" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "currentOwnerId" TEXT,
    "currentTenantId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "flatId" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "societyId" TEXT,
    "isPrimaryResident" BOOLEAN NOT NULL DEFAULT false,
    "familyRole" "FamilyRole",
    "primaryResidentId" TEXT,
    "fcmToken" TEXT,
    "deviceType" TEXT,
    "lastLogin" TIMESTAMP(3),
    "refreshToken" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastTokenRefresh" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT,
    "visitorType" "VisitorType" NOT NULL DEFAULT 'GUEST',
    "visitorPhoto" TEXT,
    "purpose" TEXT,
    "vehicleNumber" TEXT,
    "companyName" TEXT,
    "packageCount" INTEGER DEFAULT 1,
    "wasAutoApproved" BOOLEAN NOT NULL DEFAULT false,
    "autoApprovalReason" TEXT,
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "gatePointId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutTime" TIMESTAMP(3),
    "domesticStaffId" TEXT,
    "preApprovedEntryId" TEXT,
    "remarks" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestInvite" (
    "id" TEXT NOT NULL,
    "type" "GuestInviteType" NOT NULL,
    "status" "GuestInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "allowedDays" TEXT[],
    "timeFrom" TEXT,
    "timeUntil" TEXT,
    "passcode" TEXT NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyInvite" (
    "id" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "note" TEXT,
    "theme" INTEGER NOT NULL DEFAULT 0,
    "maxGuests" INTEGER NOT NULL,
    "usedSlots" INTEGER NOT NULL DEFAULT 0,
    "inviteCode" TEXT NOT NULL,
    "inviteLink" TEXT NOT NULL,
    "status" "PartyInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartySlot" (
    "id" TEXT NOT NULL,
    "partyInviteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "addedByResident" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "PartySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestEntryLog" (
    "id" TEXT NOT NULL,
    "guestInviteId" TEXT,
    "partyInviteId" TEXT,
    "inviteType" "InviteRefType" NOT NULL,
    "flatId" TEXT,
    "guardId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT,
    "passcode" TEXT NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "GuestEntryResult" NOT NULL,
    "denyReason" TEXT,
    "societyId" TEXT NOT NULL,

    CONSTRAINT "GuestEntryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomesticStaff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "photoUrl" TEXT,
    "staffType" "DomesticStaffType" NOT NULL,
    "experienceYears" INTEGER,
    "description" TEXT,
    "languages" TEXT[],
    "idProofType" TEXT,
    "idProofNumber" TEXT,
    "idProofUrl" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "isFullTime" BOOLEAN NOT NULL DEFAULT false,
    "workingDays" TEXT[],
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "availabilityStatus" "StaffAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "hourlyRate" DOUBLE PRECISION,
    "dailyRate" DOUBLE PRECISION,
    "monthlyRate" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "societyId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCurrentlyWorking" BOOLEAN NOT NULL DEFAULT false,
    "currentFlatId" TEXT,
    "lastCheckIn" TIMESTAMP(3),
    "lastCheckOut" TIMESTAMP(3),
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "flatId" TEXT,

    CONSTRAINT "DomesticStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffFlatAssignment" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "workingDays" TEXT[],
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "agreedRate" DOUBLE PRECISION,
    "rateType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffFlatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "checkOutTime" TIMESTAMP(3),
    "duration" INTEGER,
    "checkInMethod" TEXT NOT NULL DEFAULT 'QR',
    "checkOutMethod" TEXT,
    "verifiedByGuardId" TEXT,
    "notes" TEXT,
    "workCompleted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffBooking" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationHours" DOUBLE PRECISION NOT NULL,
    "workType" TEXT NOT NULL,
    "requirements" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "status" "StaffBookingStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "actualDuration" DOUBLE PRECISION,
    "finalCost" DOUBLE PRECISION,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffReview" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "workQuality" INTEGER,
    "punctuality" INTEGER,
    "behavior" INTEGER,
    "workType" TEXT,
    "workDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "model" TEXT,
    "color" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "parkingSlot" TEXT,
    "stickerNumber" TEXT,
    "lastSeen" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingViolation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "vehicleNumber" TEXT NOT NULL,
    "type" "ViolationType" NOT NULL,
    "description" TEXT,
    "source" "ViolationSource" NOT NULL DEFAULT 'OFFICIAL',
    "penaltyAmount" DOUBLE PRECISION,
    "addedToInvoice" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "reportedById" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "status" "ViolationStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorFrequency" (
    "id" TEXT NOT NULL,
    "visitorPhone" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "lastVisit" TIMESTAMP(3) NOT NULL,
    "isFrequent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorFrequency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatePass" (
    "id" TEXT NOT NULL,
    "type" "GatePassType" NOT NULL,
    "status" "GatePassStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requestedById" TEXT NOT NULL,
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "itemsList" TEXT[],
    "workerName" TEXT,
    "workerPhone" TEXT,
    "companyName" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "qrToken" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "usedByGuardId" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "type" "NoticeType" NOT NULL,
    "priority" "NoticePriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[],
    "documents" TEXT[],
    "createdById" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AmenityType" NOT NULL,
    "description" TEXT,
    "capacity" INTEGER,
    "openTime" TEXT,
    "closeTime" TEXT,
    "timings" TEXT,
    "slotDurationHours" INTEGER NOT NULL DEFAULT 1,
    "rules" TEXT[],
    "bookingDuration" INTEGER NOT NULL DEFAULT 60,
    "advanceBookingDays" INTEGER NOT NULL DEFAULT 7,
    "maxBookingsPerUser" INTEGER NOT NULL DEFAULT 2,
    "pricePerHour" DOUBLE PRECISION DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "images" TEXT[],
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmenityBooking" (
    "id" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DOUBLE PRECISION DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "guestCount" INTEGER DEFAULT 1,
    "purpose" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmenityBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "priority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[],
    "location" TEXT,
    "reportedById" TEXT NOT NULL,
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emergency" (
    "id" TEXT NOT NULL,
    "type" "EmergencyType" NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "location" TEXT,
    "reportedById" TEXT NOT NULL,
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "alertsSent" BOOLEAN NOT NULL DEFAULT false,
    "notifiedUsers" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emergency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "alternatePhone" TEXT,
    "companyName" TEXT,
    "description" TEXT,
    "address" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "rating" DOUBLE PRECISION DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workingDays" TEXT[],
    "workingHours" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "minCharge" DOUBLE PRECISION,
    "idProof" TEXT,
    "photos" TEXT[],
    "addedById" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorLike" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "PostCategory" NOT NULL DEFAULT 'GENERAL',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocietyDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeMB" DOUBLE PRECISION NOT NULL,
    "fileType" TEXT NOT NULL,
    "isAdminDoc" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocietyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PollStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "votingEndsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "votedById" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "residentType" "ResidentType" NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "resubmitReason" TEXT,
    "resubmissionCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidentDocument" (
    "id" TEXT NOT NULL,
    "onboardingRequestId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResidentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingAuditLog" (
    "id" TEXT NOT NULL,
    "onboardingRequestId" TEXT NOT NULL,
    "action" "OnboardingAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "previousStatus" "OnboardingStatus",
    "newStatus" "OnboardingStatus",
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "userId" TEXT NOT NULL,
    "societyId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryRequest" (
    "id" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "status" "EntryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "visitorName" TEXT,
    "visitorPhone" TEXT,
    "providerTag" "ProviderTag",
    "photoKey" TEXT,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreApprovedEntry" (
    "id" TEXT NOT NULL,
    "type" "PreApprovedEntryType" NOT NULL,
    "mode" "PreApprovedEntryMode" NOT NULL DEFAULT 'NORMAL',
    "scheduleType" "PreApprovedScheduleType" NOT NULL DEFAULT 'ONCE',
    "status" "PreApprovedEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "visitorName" TEXT,
    "visitorPhone" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedByGuardId" TEXT,
    "userId" TEXT NOT NULL,
    "flatId" TEXT,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreApprovedEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreApprovedSchedule" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "daysOfWeek" TEXT[],
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "entriesPerDay" INTEGER DEFAULT 1,
    "graceBeforeMinutes" INTEGER NOT NULL DEFAULT 15,
    "graceAfterMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreApprovedSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreApprovedMeta" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "vehicleLast4Digits" TEXT,
    "companyName" TEXT,
    "isSurprise" BOOLEAN NOT NULL DEFAULT false,
    "category" "HelpCategory",
    "customCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreApprovedMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreApprovedVerification" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "verificationType" "PreApprovedVerificationType" NOT NULL DEFAULT 'NONE',
    "verificationValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreApprovedVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreApprovedUsage" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "gatePointId" TEXT,
    "notes" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreApprovedUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Society_city_isActive_idx" ON "Society"("city", "isActive");

-- CreateIndex
CREATE INDEX "Society_paymentStatus_nextDueDate_idx" ON "Society"("paymentStatus", "nextDueDate");

-- CreateIndex
CREATE INDEX "Invoice_societyId_status_idx" ON "Invoice"("societyId", "status");

-- CreateIndex
CREATE INDEX "Invoice_societyId_month_idx" ON "Invoice"("societyId", "month");

-- CreateIndex
CREATE INDEX "Invoice_flatId_status_idx" ON "Invoice"("flatId", "status");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_societyId_flatId_month_key" ON "Invoice"("societyId", "flatId", "month");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SocietyRegistrationRequest_societyId_key" ON "SocietyRegistrationRequest"("societyId");

-- CreateIndex
CREATE INDEX "SocietyRegistrationRequest_status_idx" ON "SocietyRegistrationRequest"("status");

-- CreateIndex
CREATE INDEX "SocietyRegistrationRequest_requestedById_idx" ON "SocietyRegistrationRequest"("requestedById");

-- CreateIndex
CREATE INDEX "GatePoint_societyId_isActive_idx" ON "GatePoint"("societyId", "isActive");

-- CreateIndex
CREATE INDEX "Block_societyId_isActive_idx" ON "Block"("societyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Block_societyId_name_key" ON "Block"("societyId", "name");

-- CreateIndex
CREATE INDEX "Flat_societyId_idx" ON "Flat"("societyId");

-- CreateIndex
CREATE INDEX "Flat_blockId_idx" ON "Flat"("blockId");

-- CreateIndex
CREATE INDEX "Flat_isOccupied_idx" ON "Flat"("isOccupied");

-- CreateIndex
CREATE UNIQUE INDEX "Flat_societyId_flatNumber_key" ON "Flat"("societyId", "flatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_societyId_role_idx" ON "User"("societyId", "role");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_refreshToken_idx" ON "User"("refreshToken");

-- CreateIndex
CREATE INDEX "Entry_societyId_status_checkInTime_idx" ON "Entry"("societyId", "status", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "Entry_flatId_checkInTime_idx" ON "Entry"("flatId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "Entry_visitorPhone_idx" ON "Entry"("visitorPhone");

-- CreateIndex
CREATE INDEX "Entry_createdById_idx" ON "Entry"("createdById");

-- CreateIndex
CREATE INDEX "Entry_type_companyName_checkInTime_idx" ON "Entry"("type", "companyName", "checkInTime" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GuestInvite_passcode_key" ON "GuestInvite"("passcode");

-- CreateIndex
CREATE INDEX "GuestInvite_passcode_idx" ON "GuestInvite"("passcode");

-- CreateIndex
CREATE INDEX "GuestInvite_flatId_status_idx" ON "GuestInvite"("flatId", "status");

-- CreateIndex
CREATE INDEX "GuestInvite_residentId_status_idx" ON "GuestInvite"("residentId", "status");

-- CreateIndex
CREATE INDEX "GuestInvite_societyId_status_idx" ON "GuestInvite"("societyId", "status");

-- CreateIndex
CREATE INDEX "GuestInvite_status_validUntil_idx" ON "GuestInvite"("status", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PartyInvite_inviteCode_key" ON "PartyInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "PartyInvite_inviteCode_idx" ON "PartyInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "PartyInvite_flatId_status_idx" ON "PartyInvite"("flatId", "status");

-- CreateIndex
CREATE INDEX "PartyInvite_residentId_status_idx" ON "PartyInvite"("residentId", "status");

-- CreateIndex
CREATE INDEX "PartyInvite_societyId_status_idx" ON "PartyInvite"("societyId", "status");

-- CreateIndex
CREATE INDEX "PartyInvite_status_validUntil_idx" ON "PartyInvite"("status", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PartySlot_code_key" ON "PartySlot"("code");

-- CreateIndex
CREATE INDEX "PartySlot_code_idx" ON "PartySlot"("code");

-- CreateIndex
CREATE INDEX "PartySlot_partyInviteId_idx" ON "PartySlot"("partyInviteId");

-- CreateIndex
CREATE INDEX "PartySlot_phone_idx" ON "PartySlot"("phone");

-- CreateIndex
CREATE INDEX "GuestEntryLog_guestInviteId_idx" ON "GuestEntryLog"("guestInviteId");

-- CreateIndex
CREATE INDEX "GuestEntryLog_partyInviteId_idx" ON "GuestEntryLog"("partyInviteId");

-- CreateIndex
CREATE INDEX "GuestEntryLog_flatId_entryTime_idx" ON "GuestEntryLog"("flatId", "entryTime" DESC);

-- CreateIndex
CREATE INDEX "GuestEntryLog_societyId_entryTime_idx" ON "GuestEntryLog"("societyId", "entryTime" DESC);

-- CreateIndex
CREATE INDEX "GuestEntryLog_guardId_idx" ON "GuestEntryLog"("guardId");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticStaff_phone_key" ON "DomesticStaff"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticStaff_qrToken_key" ON "DomesticStaff"("qrToken");

-- CreateIndex
CREATE INDEX "DomesticStaff_qrToken_idx" ON "DomesticStaff"("qrToken");

-- CreateIndex
CREATE INDEX "DomesticStaff_societyId_staffType_idx" ON "DomesticStaff"("societyId", "staffType");

-- CreateIndex
CREATE INDEX "DomesticStaff_societyId_availabilityStatus_idx" ON "DomesticStaff"("societyId", "availabilityStatus");

-- CreateIndex
CREATE INDEX "DomesticStaff_phone_idx" ON "DomesticStaff"("phone");

-- CreateIndex
CREATE INDEX "StaffFlatAssignment_flatId_idx" ON "StaffFlatAssignment"("flatId");

-- CreateIndex
CREATE INDEX "StaffFlatAssignment_domesticStaffId_isActive_idx" ON "StaffFlatAssignment"("domesticStaffId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StaffFlatAssignment_domesticStaffId_flatId_key" ON "StaffFlatAssignment"("domesticStaffId", "flatId");

-- CreateIndex
CREATE INDEX "StaffAttendance_domesticStaffId_checkInTime_idx" ON "StaffAttendance"("domesticStaffId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "StaffAttendance_flatId_checkInTime_idx" ON "StaffAttendance"("flatId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "StaffAttendance_societyId_checkInTime_idx" ON "StaffAttendance"("societyId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "StaffBooking_domesticStaffId_bookingDate_idx" ON "StaffBooking"("domesticStaffId", "bookingDate");

-- CreateIndex
CREATE INDEX "StaffBooking_bookedById_status_idx" ON "StaffBooking"("bookedById", "status");

-- CreateIndex
CREATE INDEX "StaffBooking_flatId_bookingDate_idx" ON "StaffBooking"("flatId", "bookingDate");

-- CreateIndex
CREATE INDEX "StaffBooking_societyId_bookingDate_idx" ON "StaffBooking"("societyId", "bookingDate");

-- CreateIndex
CREATE INDEX "StaffReview_domesticStaffId_rating_idx" ON "StaffReview"("domesticStaffId", "rating");

-- CreateIndex
CREATE INDEX "StaffReview_reviewerId_idx" ON "StaffReview"("reviewerId");

-- CreateIndex
CREATE INDEX "Vehicle_userId_idx" ON "Vehicle"("userId");

-- CreateIndex
CREATE INDEX "Vehicle_societyId_status_idx" ON "Vehicle"("societyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_societyId_vehicleNumber_key" ON "Vehicle"("societyId", "vehicleNumber");

-- CreateIndex
CREATE INDEX "ParkingViolation_societyId_status_idx" ON "ParkingViolation"("societyId", "status");

-- CreateIndex
CREATE INDEX "ParkingViolation_vehicleId_status_idx" ON "ParkingViolation"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "ParkingViolation_reportedById_idx" ON "ParkingViolation"("reportedById");

-- CreateIndex
CREATE INDEX "ParkingViolation_source_status_idx" ON "ParkingViolation"("source", "status");

-- CreateIndex
CREATE INDEX "VisitorFrequency_societyId_isFrequent_idx" ON "VisitorFrequency"("societyId", "isFrequent");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorFrequency_societyId_flatId_visitorPhone_key" ON "VisitorFrequency"("societyId", "flatId", "visitorPhone");

-- CreateIndex
CREATE INDEX "PaymentReminder_societyId_isPaid_dueDate_idx" ON "PaymentReminder"("societyId", "isPaid", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "GatePass_qrToken_key" ON "GatePass"("qrToken");

-- CreateIndex
CREATE INDEX "GatePass_societyId_status_idx" ON "GatePass"("societyId", "status");

-- CreateIndex
CREATE INDEX "GatePass_flatId_validUntil_idx" ON "GatePass"("flatId", "validUntil");

-- CreateIndex
CREATE INDEX "GatePass_qrToken_idx" ON "GatePass"("qrToken");

-- CreateIndex
CREATE INDEX "Notice_societyId_isActive_publishAt_idx" ON "Notice"("societyId", "isActive", "publishAt" DESC);

-- CreateIndex
CREATE INDEX "Notice_societyId_isPinned_publishAt_idx" ON "Notice"("societyId", "isPinned", "publishAt" DESC);

-- CreateIndex
CREATE INDEX "Amenity_societyId_isActive_idx" ON "Amenity"("societyId", "isActive");

-- CreateIndex
CREATE INDEX "AmenityBooking_amenityId_bookingDate_idx" ON "AmenityBooking"("amenityId", "bookingDate");

-- CreateIndex
CREATE INDEX "AmenityBooking_userId_status_idx" ON "AmenityBooking"("userId", "status");

-- CreateIndex
CREATE INDEX "AmenityBooking_societyId_bookingDate_idx" ON "AmenityBooking"("societyId", "bookingDate");

-- CreateIndex
CREATE UNIQUE INDEX "AmenityBooking_amenityId_bookingDate_startTime_key" ON "AmenityBooking"("amenityId", "bookingDate", "startTime");

-- CreateIndex
CREATE INDEX "Complaint_societyId_status_createdAt_idx" ON "Complaint"("societyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Complaint_reportedById_status_idx" ON "Complaint"("reportedById", "status");

-- CreateIndex
CREATE INDEX "Complaint_category_status_idx" ON "Complaint"("category", "status");

-- CreateIndex
CREATE INDEX "Emergency_societyId_status_createdAt_idx" ON "Emergency"("societyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Emergency_reportedById_idx" ON "Emergency"("reportedById");

-- CreateIndex
CREATE INDEX "Vendor_societyId_category_isActive_idx" ON "Vendor"("societyId", "category", "isActive");

-- CreateIndex
CREATE INDEX "Vendor_societyId_isVerified_idx" ON "Vendor"("societyId", "isVerified");

-- CreateIndex
CREATE INDEX "VendorLike_vendorId_idx" ON "VendorLike"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorLike_vendorId_userId_key" ON "VendorLike"("vendorId", "userId");

-- CreateIndex
CREATE INDEX "CommunityPost_societyId_isActive_isPinned_createdAt_idx" ON "CommunityPost"("societyId", "isActive", "isPinned", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CommunityPost_societyId_category_isActive_idx" ON "CommunityPost"("societyId", "category", "isActive");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_isActive_idx" ON "CommunityPost"("authorId", "isActive");

-- CreateIndex
CREATE INDEX "PostLike_postId_idx" ON "PostLike"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PostComment_authorId_idx" ON "PostComment"("authorId");

-- CreateIndex
CREATE INDEX "SocietyDocument_societyId_isAdminDoc_category_idx" ON "SocietyDocument"("societyId", "isAdminDoc", "category");

-- CreateIndex
CREATE INDEX "SocietyDocument_uploadedById_isAdminDoc_idx" ON "SocietyDocument"("uploadedById", "isAdminDoc");

-- CreateIndex
CREATE INDEX "Poll_societyId_status_createdAt_idx" ON "Poll"("societyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_idx" ON "PollVote"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_votedById_idx" ON "PollVote"("votedById");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_votedById_key" ON "PollVote"("pollId", "votedById");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRequest_userId_key" ON "OnboardingRequest"("userId");

-- CreateIndex
CREATE INDEX "OnboardingRequest_userId_status_idx" ON "OnboardingRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_societyId_status_idx" ON "OnboardingRequest"("societyId", "status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_flatId_status_idx" ON "OnboardingRequest"("flatId", "status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_status_createdAt_idx" ON "OnboardingRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResidentDocument_onboardingRequestId_idx" ON "ResidentDocument"("onboardingRequestId");

-- CreateIndex
CREATE INDEX "ResidentDocument_documentType_idx" ON "ResidentDocument"("documentType");

-- CreateIndex
CREATE INDEX "OnboardingAuditLog_onboardingRequestId_createdAt_idx" ON "OnboardingAuditLog"("onboardingRequestId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OnboardingAuditLog_performedBy_idx" ON "OnboardingAuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_societyId_createdAt_idx" ON "Notification"("societyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "EntryRequest_entryId_key" ON "EntryRequest"("entryId");

-- CreateIndex
CREATE INDEX "EntryRequest_flatId_status_createdAt_idx" ON "EntryRequest"("flatId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EntryRequest_guardId_status_idx" ON "EntryRequest"("guardId", "status");

-- CreateIndex
CREATE INDEX "EntryRequest_societyId_status_idx" ON "EntryRequest"("societyId", "status");

-- CreateIndex
CREATE INDEX "EntryRequest_status_expiresAt_idx" ON "EntryRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PreApprovedEntry_societyId_status_type_idx" ON "PreApprovedEntry"("societyId", "status", "type");

-- CreateIndex
CREATE INDEX "PreApprovedEntry_flatId_status_idx" ON "PreApprovedEntry"("flatId", "status");

-- CreateIndex
CREATE INDEX "PreApprovedEntry_userId_status_idx" ON "PreApprovedEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "PreApprovedEntry_status_type_mode_idx" ON "PreApprovedEntry"("status", "type", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "PreApprovedSchedule_entryId_key" ON "PreApprovedSchedule"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "PreApprovedMeta_entryId_key" ON "PreApprovedMeta"("entryId");

-- CreateIndex
CREATE INDEX "PreApprovedMeta_vehicleLast4Digits_idx" ON "PreApprovedMeta"("vehicleLast4Digits");

-- CreateIndex
CREATE UNIQUE INDEX "PreApprovedVerification_entryId_key" ON "PreApprovedVerification"("entryId");

-- CreateIndex
CREATE INDEX "PreApprovedUsage_entryId_usedAt_idx" ON "PreApprovedUsage"("entryId", "usedAt" DESC);

-- CreateIndex
CREATE INDEX "PreApprovedUsage_guardId_idx" ON "PreApprovedUsage"("guardId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyRegistrationRequest" ADD CONSTRAINT "SocietyRegistrationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyRegistrationRequest" ADD CONSTRAINT "SocietyRegistrationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyRegistrationRequest" ADD CONSTRAINT "SocietyRegistrationRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePoint" ADD CONSTRAINT "GatePoint_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flat" ADD CONSTRAINT "Flat_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flat" ADD CONSTRAINT "Flat_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryResidentId_fkey" FOREIGN KEY ("primaryResidentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_gatePointId_fkey" FOREIGN KEY ("gatePointId") REFERENCES "GatePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_preApprovedEntryId_fkey" FOREIGN KEY ("preApprovedEntryId") REFERENCES "PreApprovedEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInvite" ADD CONSTRAINT "PartyInvite_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInvite" ADD CONSTRAINT "PartyInvite_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInvite" ADD CONSTRAINT "PartyInvite_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartySlot" ADD CONSTRAINT "PartySlot_partyInviteId_fkey" FOREIGN KEY ("partyInviteId") REFERENCES "PartyInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestEntryLog" ADD CONSTRAINT "GuestEntryLog_guestInviteId_fkey" FOREIGN KEY ("guestInviteId") REFERENCES "GuestInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestEntryLog" ADD CONSTRAINT "GuestEntryLog_partyInviteId_fkey" FOREIGN KEY ("partyInviteId") REFERENCES "PartyInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestEntryLog" ADD CONSTRAINT "GuestEntryLog_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestEntryLog" ADD CONSTRAINT "GuestEntryLog_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticStaff" ADD CONSTRAINT "DomesticStaff_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticStaff" ADD CONSTRAINT "DomesticStaff_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticStaff" ADD CONSTRAINT "DomesticStaff_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFlatAssignment" ADD CONSTRAINT "StaffFlatAssignment_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFlatAssignment" ADD CONSTRAINT "StaffFlatAssignment_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_verifiedByGuardId_fkey" FOREIGN KEY ("verifiedByGuardId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingViolation" ADD CONSTRAINT "ParkingViolation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingViolation" ADD CONSTRAINT "ParkingViolation_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingViolation" ADD CONSTRAINT "ParkingViolation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingViolation" ADD CONSTRAINT "ParkingViolation_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorFrequency" ADD CONSTRAINT "VisitorFrequency_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorFrequency" ADD CONSTRAINT "VisitorFrequency_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorLike" ADD CONSTRAINT "VendorLike_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorLike" ADD CONSTRAINT "VendorLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyDocument" ADD CONSTRAINT "SocietyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyDocument" ADD CONSTRAINT "SocietyDocument_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_votedById_fkey" FOREIGN KEY ("votedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentDocument" ADD CONSTRAINT "ResidentDocument_onboardingRequestId_fkey" FOREIGN KEY ("onboardingRequestId") REFERENCES "OnboardingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAuditLog" ADD CONSTRAINT "OnboardingAuditLog_onboardingRequestId_fkey" FOREIGN KEY ("onboardingRequestId") REFERENCES "OnboardingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAuditLog" ADD CONSTRAINT "OnboardingAuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedEntry" ADD CONSTRAINT "PreApprovedEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedEntry" ADD CONSTRAINT "PreApprovedEntry_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedEntry" ADD CONSTRAINT "PreApprovedEntry_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedSchedule" ADD CONSTRAINT "PreApprovedSchedule_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PreApprovedEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedMeta" ADD CONSTRAINT "PreApprovedMeta_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PreApprovedEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedVerification" ADD CONSTRAINT "PreApprovedVerification_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PreApprovedEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedUsage" ADD CONSTRAINT "PreApprovedUsage_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PreApprovedEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApprovedUsage" ADD CONSTRAINT "PreApprovedUsage_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

