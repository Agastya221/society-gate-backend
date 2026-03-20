import { prisma } from '../../utils/Client';
import { verifyQRToken } from '../../utils/QrGenerate';
import { AppError } from '../../utils/ResponseHandler';
import { InviteService } from '../invite/invite.service';
import { eventBus } from '../../utils/eventBus';

const inviteService = new InviteService();

interface ScanResult {
  type: 'INVITE_PASS' | 'GATE_PASS' | 'DOMESTIC_STAFF';
  allowed: boolean;
  reason: string;
  entry?: object;
  data?: object;
}

export class GateScanService {
  /**
   * Universal QR scan endpoint. Detects the pass type and processes accordingly.
   * Returns a unified ScanResult that the guard app can display.
   */
  async scan(qrToken: string, guardId: string, gatePointId?: string): Promise<ScanResult> {
    // Decode token to get payload — we use it to determine which table to look up
    let payload: Record<string, unknown>;
    try {
      const decoded = verifyQRToken(qrToken);
      payload = typeof decoded === 'string' ? {} : (decoded as Record<string, unknown>);
    } catch {
      throw new AppError('Invalid or expired QR code', 400);
    }

    // Route by pass type in payload
    if (payload.staffId) {
      return this._scanDomesticStaff(qrToken, guardId);
    }

    // Try InvitePass
    const invitePass = await prisma.invitePass.findUnique({ where: { qrToken } });
    if (invitePass) {
      return this._processInvitePass(invitePass, guardId, gatePointId);
    }

    // Try GatePass
    const gatePass = await prisma.gatePass.findUnique({ where: { qrToken } });
    if (gatePass) {
      return this._processGatePass(gatePass, guardId, gatePointId);
    }

    throw new AppError('QR code not found in system', 404);
  }

  // ---------- InvitePass ----------

  private async _processInvitePass(
    invite: Awaited<ReturnType<typeof prisma.invitePass.findUnique>> & object,
    guardId: string,
    gatePointId?: string
  ): Promise<ScanResult> {
    if (!invite) throw new AppError('Invite pass not found', 404);

    const now = new Date();

    if (invite.status === 'CANCELLED') {
      return { type: 'INVITE_PASS', allowed: false, reason: 'This invite has been cancelled by the resident', data: invite };
    }
    if (invite.status === 'USED') {
      return { type: 'INVITE_PASS', allowed: false, reason: 'This invite has already been fully used', data: invite };
    }
    if (invite.status === 'EXPIRED' || now > invite.validUntil) {
      return { type: 'INVITE_PASS', allowed: false, reason: 'This invite has expired', data: invite };
    }
    if (now < invite.validFrom) {
      return { type: 'INVITE_PASS', allowed: false, reason: `This invite is not valid until ${invite.validFrom.toLocaleDateString()}`, data: invite };
    }

    // Check allowed days
    if (invite.allowedDays.length > 0) {
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const today = dayNames[now.getDay()];
      if (!invite.allowedDays.includes(today)) {
        return { type: 'INVITE_PASS', allowed: false, reason: `Not allowed today (${today}). Allowed: ${invite.allowedDays.join(', ')}`, data: invite };
      }
    }

    // Check time window
    if (invite.timeFrom && invite.timeUntil) {
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      if (currentTime < invite.timeFrom || currentTime > invite.timeUntil) {
        return { type: 'INVITE_PASS', allowed: false, reason: `Only allowed between ${invite.timeFrom}–${invite.timeUntil}`, data: invite };
      }
    }

    // All checks passed — create Entry
    const guard = await prisma.user.findUnique({ where: { id: guardId }, select: { societyId: true } });

    const entry = await prisma.entry.create({
      data: {
        type: this._inviteTypeToEntryType(invite.type),
        status: 'APPROVED',
        visitorName: invite.visitorName ?? invite.companyName ?? invite.type,
        visitorPhone: invite.visitorPhone ?? undefined,
        visitorType: 'GUEST',
        companyName: invite.companyName ?? undefined,
        vehicleNumber: invite.vehicleNumber ?? undefined,
        purpose: invite.purpose ?? undefined,
        wasAutoApproved: true,
        autoApprovalReason: `InvitePass: ${invite.type}`,
        flatId: invite.flatId,
        societyId: invite.societyId,
        gatePointId: gatePointId ?? undefined,
        createdById: guardId,
        approvedAt: now,
        invitePassId: invite.id,
      },
    });

    await inviteService.recordUsage(invite.id);

    eventBus.emit('invite-pass.scanned', {
      invitePassId: invite.id,
      entryId: entry.id,
      flatId: invite.flatId,
      societyId: invite.societyId,
      visitorName: invite.visitorName ?? invite.companyName ?? invite.type,
      type: invite.type,
      guardId,
    });

    return {
      type: 'INVITE_PASS',
      allowed: true,
      reason: `Access granted via ${invite.type} invite`,
      entry,
      data: invite,
    };
  }

  // ---------- GatePass ----------

  private async _processGatePass(
    gatePass: Awaited<ReturnType<typeof prisma.gatePass.findUnique>> & object,
    guardId: string,
    gatePointId?: string
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

  // ---------- Domestic Staff ----------

  private async _scanDomesticStaff(qrToken: string, guardId: string): Promise<ScanResult> {
    const staff = await prisma.domesticStaff.findUnique({ where: { qrToken } });
    if (!staff) throw new AppError('Staff QR code not found', 404);
    if (!staff.isActive) {
      return { type: 'DOMESTIC_STAFF', allowed: false, reason: 'Staff account is inactive', data: staff };
    }

    return { type: 'DOMESTIC_STAFF', allowed: true, reason: 'Staff QR verified. Use check-in endpoint to record attendance.', data: staff };
  }

  // ---------- Helpers ----------

  private _inviteTypeToEntryType(inviteType: string): 'VISITOR' | 'DELIVERY' | 'CAB' | 'VENDOR' | 'DOMESTIC_STAFF' {
    switch (inviteType) {
      case 'GUEST': return 'VISITOR';
      case 'DELIVERY_ONCE':
      case 'DELIVERY_STANDING': return 'DELIVERY';
      case 'CAB': return 'CAB';
      case 'SERVICE': return 'VENDOR';
      default: return 'VISITOR';
    }
  }
}
