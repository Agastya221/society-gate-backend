import { EventEmitter } from 'events';
import logger from './logger';

// ARCH-3: Event-driven notifications via EventEmitter
// Decouples notification logic from business logic.
// Services emit domain events; listeners (e.g., notification service) react independently.

export interface AppEvents {
  'entry-request.created': {
    entryRequestId: string;
    flatId: string;
    societyId: string;
    visitorName?: string;
    providerTag?: string;
    type: string;
  };
  'emergency.created': {
    emergencyId: string;
    societyId: string;
    type: string;
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
    flatId: string;
    societyId: string;
    staffId: string;
    staffName: string;
    staffType: string;
    checkInTime: Date;
  };
  'staff.checked-out': {
    attendanceId: string;
    flatId: string;
    societyId: string;
    staffId: string;
    staffName: string;
    staffType: string;
    checkOutTime: Date;
    duration?: number;
  };
  'staff.booking-created': {
    bookingId: string;
    flatId: string;
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
  'guest-invite.verified': {
    inviteType: string;
    flatId: string;
    societyId: string;
    visitorName: string;
    guardId: string;
    allowed: boolean;
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
