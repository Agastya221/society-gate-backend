import { prisma } from '../../utils/Client';
import { verifyQRToken } from '../../utils/QrGenerate';
import { AppError } from '../../utils/ResponseHandler';
import { eventBus } from '../../utils/eventBus';
import { preApprovedEntryService } from '../pre-approved-entry/pre-approved-entry.service';

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
}

export class GateScanService {
  /**
   * Universal QR scan endpoint (GatePass + DomesticStaff only).
   * InvitePass scanning is now handled by verifyCode() with passcodes.
   */
  async scan(qrToken: string, guardId: string, gatePointId?: string): Promise<ScanResult> {
    let payload: Record<string, unknown>;
    try {
      const decoded = verifyQRToken(qrToken);
      payload = typeof decoded === 'string' ? {} : (decoded as Record<string, unknown>);
    } catch {
      throw new AppError('Invalid or expired QR code', 400);
    }

    if (payload.staffId) {
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
   *  2. Invite status = ACTIVE
   *  3. now() >= validFrom
   *  4. now() <= validUntil
   *  5. FREQUENT: today's day in allowedDays
   *  6. FREQUENT: current time between timeFrom and timeUntil
   *  7. QUICK/PRIVATE: usedCount < maxUses
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
    let denyReason: string | null = null;

    if (party.status !== 'ACTIVE') denyReason = 'CANCELLED';
    else if (now < party.validFrom) denyReason = 'NOT_YET_VALID';
    else if (now > party.validUntil) denyReason = 'EXPIRED';
    else if (!slot.phone) denyReason = 'UNCLAIMED_SLOT';

    const status = denyReason ? 'DENIED' : 'ALLOWED';

    await prisma.guestEntryLog.create({
      data: {
        partyInviteId: party.id,
        inviteType: 'PARTY_INVITE',
        flatId: party.flatId,
        guardId,
        visitorName: slot.name ?? 'Party Guest',
        visitorPhone: slot.phone,
        passcode: code,
        status: status as any,
        denyReason,
        societyId,
      },
    });

    if (denyReason) {
      return {
        allowed: false,
        reason: denyReason,
        message: this._getDenyMessage(denyReason),
      };
    }

    return {
      allowed: true,
      inviteType: 'PARTY',
      visitorName: slot.name,
      visitorPhone: slot.phone,
      flatId: party.flatId,
      flatNumber: party.flat.flatNumber,
      residentName: party.resident.name,
      isPrivate: false,
      validUntil: party.validUntil,
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
    let denyReason: string | null = null;

    if (invite.status !== 'ACTIVE') denyReason = 'REVOKED';
    else if (now < invite.validFrom) denyReason = 'NOT_YET_VALID';
    else if (now > invite.validUntil) denyReason = 'EXPIRED';
    else if (invite.type === 'FREQUENT') {
      if (invite.allowedDays.length > 0 && !invite.allowedDays.includes(currentDay)) {
        denyReason = 'WRONG_DAY';
      } else if (invite.timeFrom && invite.timeUntil) {
        if (currentTime < invite.timeFrom || currentTime > invite.timeUntil) {
          denyReason = 'OUTSIDE_HOURS';
        }
      }
    } else if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
      denyReason = 'MAX_USES_REACHED';
    }

    const status = denyReason ? 'DENIED' : 'ALLOWED';

    await prisma.guestEntryLog.create({
      data: {
        guestInviteId: invite.id,
        inviteType: 'GUEST_INVITE',
        flatId: invite.flatId,
        guardId,
        visitorName: invite.visitorName,
        visitorPhone: invite.visitorPhone,
        passcode: code,
        status: status as any,
        denyReason,
        societyId,
      },
    });

    if (denyReason) {
      return {
        allowed: false,
        reason: denyReason,
        message: this._getDenyMessage(denyReason, invite),
      };
    }

    // Increment usedCount for QUICK/PRIVATE
    if (invite.type !== 'FREQUENT') {
      const newCount = invite.usedCount + 1;
      await prisma.guestInvite.update({
        where: { id: invite.id },
        data: {
          usedCount: newCount,
          ...(invite.maxUses !== null && newCount >= invite.maxUses ? { status: 'EXPIRED' } : {}),
        },
      });
    }

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
      flatNumber: invite.flat.flatNumber,
      residentName: invite.resident.name,
      isPrivate: invite.isPrivate,
      validUntil: invite.validUntil,
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
    const staff = await prisma.domesticStaff.findUnique({ where: { qrToken } });
    if (!staff) throw new AppError('Staff QR code not found', 404);
    if (!staff.isActive) {
      return { type: 'DOMESTIC_STAFF', allowed: false, reason: 'Staff account is inactive', data: staff };
    }
    return { type: 'DOMESTIC_STAFF', allowed: true, reason: 'Staff QR verified. Use check-in endpoint.', data: staff };
  }

  // ============================================
  // PRIVATE: Deny message helper
  // ============================================
  private _getDenyMessage(reason: string, invite?: any): string {
    switch (reason) {
      case 'CANCELLED': return 'This invite has been cancelled';
      case 'REVOKED': return 'This invite has been revoked by the resident';
      case 'NOT_YET_VALID': return 'This invite is not valid yet';
      case 'EXPIRED': return 'This invite has expired';
      case 'WRONG_DAY': return `This guest is not allowed today`;
      case 'OUTSIDE_HOURS':
        return invite?.timeFrom && invite?.timeUntil
          ? `This guest is only allowed between ${invite.timeFrom} - ${invite.timeUntil}`
          : 'Outside allowed hours';
      case 'MAX_USES_REACHED': return 'This invite has already been used';
      case 'UNCLAIMED_SLOT': return 'This slot has not been claimed by a guest';
      default: return 'Access denied';
    }
  }
}
