import { EventEmitter } from 'events';
import logger from './logger';

// ARCH-3: Event-driven notifications via EventEmitter
// Decouples notification logic from business logic.
// Services emit domain events; listeners (e.g., notification service) react independently.

export interface AppEvents {
  'entry-request.created': {
    entryRequestId: string;
    flatId: string;
    flatIds: string[];
    flats: { flatId: string; flatNumber: string; blockName: string | null }[];
    societyId: string;
    societyName?: string;
    guardId: string;
    visitorName?: string;
    providerTag?: string;
    purpose?: string;
    type: string;
    peopleCount?: number;
  };
  'entry-request.approved': {
    entryRequestId: string;
    flatId: string;
    flatIds: string[];
    flats: { flatId: string; flatNumber: string; blockName: string | null }[];
    societyId: string;
    guardId: string;
    visitorName: string;
    visitorType: string;
    approvedById: string;   // excluded from flat notification
    approvedByName: string;
    autoApproved?: boolean; // society auto-approval rule (approvedById is the guard)
    peopleCount?: number;   // how many arrived
    approvedCount?: number | null; // how many the resident allowed (null = everyone)
  };
  'entry-request.admitted': {
    entryRequestId: string;
    societyId: string;
    flatId: string;
    guardId: string;
    visitorName: string;
    visitorType: string;
  };
  'entry-request.rejected': {
    entryRequestId: string;
    flatId: string;
    flatIds: string[];
    flats: { flatId: string; flatNumber: string; blockName: string | null }[];
    societyId: string;
    guardId: string;
    visitorName: string;
    visitorType: string;
    rejectedById: string;   // excluded from flat notification
    rejectedByName: string;
    reason?: string;
  };
  // Guard cleared an approved visitor who left the gate without entering — the resident
  // granted entry but should know nobody actually came in.
  'entry-request.no-show': {
    entryRequestId: string;
    flatId: string;
    flatIds: string[];
    flats: { flatId: string; flatNumber: string; blockName: string | null }[];
    societyId: string;
    guardId: string;
    visitorName: string;
    visitorType: string;
  };
  // Cron (expiry.job.ts): an APPROVED request sat unused past READY_WINDOW_MS —
  // the resident's permission lapsed because the visitor never arrived at the gate.
  'entry-request.approval-expired': {
    entryRequestId: string;
    flatId: string;
    flatIds: string[];
    flats: { flatId: string; flatNumber: string; blockName: string | null }[];
    societyId: string;
    visitorName: string;
    visitorType: string;
  };
  'emergency.created': {
    emergencyId: string;
    societyId: string;
    type: string;
    severity: 'CRITICAL' | 'STANDARD';
    blockId: string | null;   // for STANDARD tier — notify same-block residents
    location?: string;
    description?: string;
    reporterName: string;
  };
  'emergency.responded': {
    emergencyId: string;
    reporterId: string;
    responderName: string;
    societyId: string;
  };
  'emergency.resolved': {
    emergencyId: string;
    reporterId: string;
    resolverName: string;
    societyId: string;
    notifiedUsers: string[];  // original alert audience — for all-clear guarantee
  };
  'emergency.false-alarm': {
    emergencyId: string;
    societyId: string;
    type: string;
    notifiedUsers: string[];
    cancelledByReporter: boolean;
  };
  'staff.checked-in': {
    attendanceId: string;
    flatId?: string;
    flatIds: string[];
    societyId: string;
    staffId: string;
    staffName: string;
    staffType: string;
    checkInTime: Date;
  };
  'staff.checked-out': {
    attendanceId: string;
    flatId?: string;
    flatIds: string[];
    societyId: string;
    staffId: string;
    staffName: string;
    staffType: string;
    checkOutTime: Date;
    duration?: number;
  };
  'staff.booking-created': {
    bookingId: string;
    staffId: string;
    flatId: string;
    societyId: string;
    staffName: string;
    staffType: string;
    bookingDate: Date;
  };
  'staff.booking-cancelled': {
    bookingId: string;
    staffId: string;
    societyId: string;
    staffName: string;
    staffType: string;
    bookingDate: Date;
  };
  'staff.booking-accepted': {
    bookingId: string;
    bookedById: string;
    staffName: string;
    staffType: string;
    societyId: string;
  };
  'staff.booking-rejected': {
    bookingId: string;
    bookedById: string;
    staffName: string;
    staffType: string;
    societyId: string;
    reason?: string;
  };
  'guest-invite.used': {
    inviteId: string;
    inviteType: string;
    isPrivate: boolean;
    visitorName: string;
    visitorPhone: string | null;
    flatId: string;
    societyId: string;
    guardId: string;
    guardName: string;
    residentName: string; // flat member who created (pre-allowed) the invite
  };
  'pre-approved.created': {
    entryId: string;
    flatId: string;
    societyId: string;
    type: string;
    mode: string;
    displayLabel: string;
    createdByUserId: string;
    createdByName: string;
  };
  'pre-approved.entry-used': {
    entryId: string;
    flatId: string;
    societyId: string;
    type: string;
    mode: string;
    displayLabel: string;
    visitorName?: string;
    companyName?: string;
    category?: string;
    guardId: string;
  };
  'pre-approved.cancelled-by-admin': {
    entryId: string;
    flatId: string;
    societyId: string;
    displayLabel: string;
    adminName: string;
    reason?: string;
    createdByUserId: string;
  };
  'pre-approved.expiring-soon': {
    entryId: string;
    flatId: string;
    societyId: string;
    displayLabel: string;
    expiresAt: Date;
  };
  // ---- Admin-facing events ----
  'onboarding.submitted': {
    requestId: string;
    societyId: string;
    societyName: string;
    residentName: string;
    residentPhone: string;
    flatNumber: string;
    blockName: string;
    residentType: string;
    isLivingHere?: boolean;
    userId: string;
  };
  'onboarding.approved': {
    requestId: string;
    societyId: string;
    userId: string;        // resident who was approved
    residentName: string;
    flatId: string;
  };
  'onboarding.rejected': {
    requestId: string;
    societyId: string;
    userId: string;        // resident who was rejected
    reason: string;
  };
  'complaint.created': {
    complaintId: string;
    societyId: string;
    category: string;
    priority: string;
    title: string;
    reportedByName: string;
    flatNumber: string | null;
    blockName: string | null;
    isAnonymous: boolean;
  };
  'onboarding.submitted_to_owner': {
    requestId: string;
    ownerUserId: string;
    societyId: string;
    flatId: string;
    tenantName: string;
    tenantPhone: string;
    flatNumber: string;
    blockName: string;
  };
  'onboarding.tenant_approved_by_owner': {
    requestId: string;
    societyId: string;
    tenantName: string;
    blockName: string;
    flatNumber: string;
    ownerName: string;
    tenantId: string;
    ownerId: string;
  };
  'onboarding.resubmit_requested': {
    requestId: string;
    societyId: string;
    userId: string;
    reason: string;
  };
  'family.member_added_by_tenant': {
    ownerId: string;
    tenantName: string;
    memberName: string;
    flatId: string;
    societyId: string;
    flatNumber: string;
    blockName: string;
  };
}

class AppEventBus extends EventEmitter {
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): boolean {
    logger.debug({ event, payload }, 'Event emitted');
    return super.emit(event, payload);
  }

  on<K extends keyof AppEvents>(event: K, listener: (payload: AppEvents[K]) => void): this {
    return super.on(event, listener);
  }
}

export const eventBus = new AppEventBus();

// Increase max listeners since multiple handlers may subscribe
eventBus.setMaxListeners(20);
