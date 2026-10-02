import { prisma } from '../../utils/Client';
import { verifyQRToken } from '../../utils/QrGenerate';
import { AppError } from '../../utils/ResponseHandler';
import { eventBus } from '../../utils/eventBus';
import { preApprovedEntryService } from '../pre-approved-entry/pre-approved-entry.service';
import { DomesticStaffService } from '../domestic-staff/domestic-staff.service';
import {
  resolveGuestInviteDenyReason,
  resolvePartyDenyReason,
  getVerifyDenyMessage,
} from './verify-code.rules';

const domesticStaffService = new DomesticStaffService();

interface ScanResult {
  type: 'GATE_PASS' | 'DOMESTIC_STAFF' | 'PRE_APPROVED';
  allowed: boolean;
  reason: string;
  entry?: object;
  data?: object;
}

interface VerifyCodeResult {
  allowed: boolean;
  inviteType?: string;
  visitorName?: string;
  visitorPhone?: string | null;
  flatId?: string;
  flatNumber?: string;
  residentName?: string;
  isPrivate?: boolean;
  validUntil?: Date;
  reason?: string;
  message?: string;
  /** Entry created for an allowed passcode (additive field) */
  entryId?: string;
}

export class GateScanService {
  /**
   * Universal QR scan endpoint (GatePass + DomesticStaff only).
   * InvitePass scanning is now handled by verifyCode() with passcodes.
   */
  async scan(qrToken: string, guardId: string, gatePointId?: string): Promise<ScanResult> {
    // The database token is authoritative for staff passes. Looking it up
    // first also keeps already-issued passes valid if JWT signing keys rotate.
    const storedStaff = await prisma.domesticStaff.findUnique({
      where: { qrToken },
      select: { id: true },
    });
    if (storedStaff) {
      return this._scanDomesticStaff(qrToken, guardId);
    }

    let payload: Record<string, unknown>;
    try {
      const decoded = verifyQRToken(qrToken);
      payload = typeof decoded === 'string' ? {} : (decoded as Record<string, unknown>);
    } catch {
      throw new AppError('Invalid or expired QR code', 400);
    }

    // Current staff passes use type=domestic_staff. Keep staffId support for
    // older passes already issued before the payload was simplified.
    if (payload.staffId || payload.type === 'domestic_staff') {
      return this._scanDomesticStaff(qrToken, guardId);
    }

    // Pre-approved entry QR
    if (payload.type === 'pre_approved' && payload.entryId) {
      const result = await preApprovedEntryService.validate(
        { qrToken },
        guardId,
      );
      return {
        type: 'PRE_APPROVED',
        allowed: result.allowed,
        reason: result.allowed ? 'Pre-approved entry validated' : (result.reason || 'Validation failed'),
        data: result,
      };
    }

    const gatePass = await prisma.gatePass.findUnique({ where: { qrToken } });
    if (gatePass) {
      return this._processGatePass(gatePass, guardId, gatePointId);
    }

    throw new AppError('QR code not found in system', 404);
  }

  /**
   * Universal passcode verification — works for all invite types.
   * Searches PartySlot.code first, then GuestInvite.passcode.
   *
   * Validation checks (in order):
   *  1. Code exists
   *  2. Deny reason resolved by verify-code.rules.ts (REVOKED / CANCELLED /
   *     MAX_USES_REACHED / EXPIRED / NOT_STARTED / WRONG_DAY / OUTSIDE_HOURS / UNCLAIMED_SLOT)
   *  3. Allowed -> GuestEntryLog + CHECKED_IN Entry (+ one use consumed for limited passes)
   */
  async verifyCode(code: string, guardId: string): Promise<VerifyCodeResult> {
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: { societyId: true, name: true },
    });
    if (!guard?.societyId) throw new AppError('Guard not assigned to society', 400);

    const now = new Date();
    // IST time (UTC+5:30) for day/time checks
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = dayNames[istNow.getUTCDay()];
    const currentTime = istNow.toISOString().slice(11, 16); // "HH:MM"

    // --- 1. Check PartySlot ---
    const slot = await prisma.partySlot.findUnique({
      where: { code },
      include: {
        partyInvite: {
          include: {
            flat: { select: { flatNumber: true } },
            resident: { select: { name: true } },
          },
        },
      },
    });

    if (slot) {
      return this._verifyPartySlot(slot, guard.societyId, guardId, code, now);
    }

    // --- 2. Check GuestInvite ---
    const guestInvite = await prisma.guestInvite.findUnique({
      where: { passcode: code },
      include: {
        flat: { select: { flatNumber: true } },
        resident: { select: { name: true } },
      },
    });

    if (guestInvite) {
      return this._verifyGuestInvite(guestInvite, guard.societyId, guardId, guard.name ?? 'Guard', code, now, currentDay, currentTime);
    }

    // --- Not found ---
    throw new AppError('Invalid code', 404);
  }

  /**
   * Get entry log for guard/admin view.
   */
  async getEntryLog(societyId: string, page = 1, limit = 30) {
    const [logs, total] = await Promise.all([
      prisma.guestEntryLog.findMany({
        where: { societyId },
        orderBy: { entryTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.guestEntryLog.count({ where: { societyId } }),
    ]);

    return {
      logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // PRIVATE: Party slot verification
  // ============================================
  private async _verifyPartySlot(
    slot: any,
    societyId: string,
    guardId: string,
    code: string,
    now: Date,
  ): Promise<VerifyCodeResult> {
    const party = slot.partyInvite;
    const denyReason = resolvePartyDenyReason(party, slot.phone ?? null, now);

    if (denyReason) {
      await prisma.guestEntryLog.create({
        data: {
          partyInviteId: party.id,
          inviteType: 'PARTY_INVITE',
          flatId: party.flatId,
          guardId,
          visitorName: slot.name ?? 'Party Guest',
          visitorPhone: slot.phone,
          passcode: code,
          status: 'DENIED',
          denyReason,
          societyId,
        },
      });
      return {
        allowed: false,
        reason: denyReason,
        message: getVerifyDenyMessage(denyReason, {
          kind: 'PARTY',
          validFrom: party.validFrom,
          validUntil: party.validUntil,
        }),
      };
    }

    // Allowed: audit log + a CHECKED_IN Entry so the guest shows up in the guard's
    // Today's Entries and can be checked out (mirrors approved EntryRequests).
    const entry = await prisma.$transaction(async (tx) => {
      await tx.guestEntryLog.create({
        data: {
          partyInviteId: party.id,
          inviteType: 'PARTY_INVITE',
          flatId: party.flatId,
          guardId,
          visitorName: slot.name ?? 'Party Guest',
          visitorPhone: slot.phone,
          passcode: code,
          status: 'ALLOWED',
          denyReason: null,
          societyId,
        },
      });
      return tx.entry.create({
        data: {
          type: 'VISITOR',
          visitorType: 'GUEST',
          status: 'CHECKED_IN',
          checkInTime: now,
          visitorName: slot.name || 'Party Guest',
          visitorPhone: slot.phone,
          purpose: 'Party invite',
          wasAutoApproved: true,
          autoApprovalReason: 'Party invite passcode',
          flatId: party.flatId,
          societyId,
          createdById: guardId,
          approvedById: party.residentId,
          approvedAt: now,
          remarks: `Party passcode ${code}`,
        },
        select: { id: true },
      });
    });

    return {
      allowed: true,
      inviteType: 'PARTY',
      visitorName: slot.name,
      visitorPhone: slot.phone,
      flatId: party.flatId,
      flatNumber: party.flat?.flatNumber,
      residentName: party.resident.name,
      isPrivate: false,
      validUntil: party.validUntil,
      entryId: entry.id,
    };
  }

  // ============================================
  // PRIVATE: Guest invite verification
  // ============================================
  private async _verifyGuestInvite(
    invite: any,
    societyId: string,
    guardId: string,
    guardName: string,
    code: string,
    now: Date,
    currentDay: string,
    currentTime: string,
  ): Promise<VerifyCodeResult> {
    let denyReason = resolveGuestInviteDenyReason(invite, now, currentDay, currentTime);

    // Consume one use for limited passes with a conditional update so two guards
    // scanning the same one-time code at once can't both let the guest in.
    if (!denyReason && invite.maxUses !== null) {
      const newCount = invite.usedCount + 1;
      const consumed = await prisma.guestInvite.updateMany({
        where: { id: invite.id, status: 'ACTIVE', usedCount: invite.usedCount },
        data: {
          usedCount: newCount,
          ...(newCount >= invite.maxUses ? { status: 'EXPIRED' as const } : {}),
        },
      });
      if (consumed.count === 0) denyReason = 'MAX_USES_REACHED';
    }

    const logData = {
      guestInviteId: invite.id,
      inviteType: 'GUEST_INVITE' as const,
      flatId: invite.flatId,
      guardId,
      visitorName: invite.visitorName,
      visitorPhone: invite.visitorPhone,
      passcode: code,
      societyId,
    };

    if (denyReason) {
      await prisma.guestEntryLog.create({
        data: { ...logData, status: 'DENIED', denyReason },
      });
      return {
        allowed: false,
        reason: denyReason,
        message: getVerifyDenyMessage(denyReason, {
          kind: 'GUEST',
          validFrom: invite.validFrom,
          validUntil: invite.validUntil,
          timeFrom: invite.timeFrom,
          timeUntil: invite.timeUntil,
        }),
      };
    }

    // Allowed: audit log + a CHECKED_IN Entry so the guest shows up in the guard's
    // Today's Entries and can be checked out (mirrors approved EntryRequests).
    const entry = await prisma.$transaction(async (tx) => {
      await tx.guestEntryLog.create({
        data: { ...logData, status: 'ALLOWED', denyReason: null },
      });
      return tx.entry.create({
        data: {
          type: 'VISITOR',
          visitorType: 'GUEST',
          status: 'CHECKED_IN',
          checkInTime: now,
          visitorName: invite.visitorName || 'Guest',
          visitorPhone: invite.visitorPhone,
          purpose: invite.note ?? null,
          wasAutoApproved: true,
          autoApprovalReason: invite.isPrivate ? 'Private guest invite passcode' : 'Guest invite passcode',
          flatId: invite.flatId,
          societyId,
          createdById: guardId,
          approvedById: invite.residentId,
          approvedAt: now,
          remarks: `Guest passcode ${code}`,
        },
        select: { id: true },
      });
    });

    // Emit notification event — listener handles FCM + in-app
    // PRIVATE invites are deliberately excluded (silent entry)
    eventBus.emit('guest-invite.used', {
      inviteId: invite.id,
      inviteType: invite.type,
      isPrivate: invite.isPrivate,
      visitorName: invite.visitorName,
      visitorPhone: invite.visitorPhone ?? null,
      flatId: invite.flatId,
      societyId,
      guardId,
      guardName,
      residentName: invite.resident.name,
    });

    return {
      allowed: true,
      inviteType: invite.type,
      visitorName: invite.visitorName,
      visitorPhone: invite.visitorPhone,
      flatId: invite.flatId,
      flatNumber: invite.flat?.flatNumber,
      residentName: invite.resident.name,
      isPrivate: invite.isPrivate,
      validUntil: invite.validUntil,
      entryId: entry.id,
    };
  }

  // ============================================
  // PRIVATE: GatePass (unchanged)
  // ============================================
  private async _processGatePass(
    gatePass: Awaited<ReturnType<typeof prisma.gatePass.findUnique>> & object,
    guardId: string,
    gatePointId?: string,
  ): Promise<ScanResult> {
    if (!gatePass) throw new AppError('Gate pass not found', 404);
    const now = new Date();

    if (gatePass.status !== 'APPROVED' && gatePass.status !== 'ACTIVE') {
      return { type: 'GATE_PASS', allowed: false, reason: `Gate pass status: ${gatePass.status}`, data: gatePass };
    }
    if (now > gatePass.validUntil) {
      await prisma.gatePass.update({ where: { id: gatePass.id }, data: { status: 'EXPIRED' } });
      return { type: 'GATE_PASS', allowed: false, reason: 'Gate pass has expired', data: gatePass };
    }

    await prisma.gatePass.update({
      where: { id: gatePass.id },
      data: { isUsed: true, usedAt: now, usedByGuardId: guardId, status: 'USED' },
    });

    return { type: 'GATE_PASS', allowed: true, reason: 'Gate pass verified', data: gatePass };
  }

  // ============================================
  // PRIVATE: Domestic Staff (unchanged)
  // ============================================
  private async _scanDomesticStaff(qrToken: string, guardId: string): Promise<ScanResult> {
    const [guard, staff] = await Promise.all([
      prisma.user.findUnique({
        where: { id: guardId },
        select: { societyId: true },
      }),
      prisma.domesticStaff.findUnique({
        where: { qrToken },
        select: {
          id: true,
          name: true,
          staffType: true,
          photoUrl: true,
          societyId: true,
          isActive: true,
          isVerified: true,
          isCurrentlyWorking: true,
          lastCheckIn: true,
          lastCheckOut: true,
          assignedFlats: {
            where: { isActive: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: { flatId: true },
          },
        },
      }),
    ]);
    if (!staff) throw new AppError('Staff QR code not found', 404);
    if (!guard?.societyId || staff.societyId !== guard.societyId) {
      return { type: 'DOMESTIC_STAFF', allowed: false, reason: 'This staff member belongs to another society' };
    }
    if (!staff.isActive) {
      return { type: 'DOMESTIC_STAFF', allowed: false, reason: 'Staff account is inactive', data: staff };
    }
    if (!staff.isVerified) {
      return { type: 'DOMESTIC_STAFF', allowed: false, reason: 'Staff account is not verified', data: staff };
    }

    const attendanceAction = staff.isCurrentlyWorking ? 'CHECKED_OUT' : 'CHECKED_IN';
    const attendance = staff.isCurrentlyWorking
      ? await domesticStaffService.checkOut(staff.id)
      : await domesticStaffService.checkIn({
          domesticStaffId: staff.id,
          flatId: staff.assignedFlats[0]?.flatId,
          societyId: staff.societyId,
          checkInMethod: 'QR',
        }, guardId);

    const { assignedFlats: _assignedFlats, ...publicStaff } = staff;
    return {
      type: 'DOMESTIC_STAFF',
      allowed: true,
      reason: attendanceAction === 'CHECKED_IN'
        ? 'Staff checked in successfully'
        : 'Staff checked out successfully',
      data: {
        ...publicStaff,
        isCurrentlyWorking: attendanceAction === 'CHECKED_IN',
        attendanceAction,
        attendanceId: attendance.id,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        duration: attendance.duration,
      },
    };
  }
}
