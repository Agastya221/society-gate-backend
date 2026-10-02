/**
 * Pure decision rules for guard passcode verification (POST /guard/verify-code).
 * Kept free of Prisma/IO so the deny-reason logic can be checked in isolation.
 *
 * Deny reason codes (returned as `data.reason`, stored in GuestEntryLog.denyReason):
 *  - REVOKED           resident revoked the guest invite
 *  - CANCELLED         resident cancelled the party invite
 *  - MAX_USES_REACHED  one-time pass already used (usedCount >= maxUses), even if
 *                      the row was flipped to EXPIRED after that use
 *  - EXPIRED           validity window is over
 *  - NOT_STARTED       validity window hasn't begun yet
 *  - WRONG_DAY / OUTSIDE_HOURS   FREQUENT invite schedule checks
 *  - UNCLAIMED_SLOT    party slot has no guest attached
 */

export type VerifyDenyReason =
  | 'REVOKED'
  | 'CANCELLED'
  | 'MAX_USES_REACHED'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'WRONG_DAY'
  | 'OUTSIDE_HOURS'
  | 'UNCLAIMED_SLOT';

export interface GuestInviteRuleInput {
  type: string; // QUICK | FREQUENT | PRIVATE
  status: string; // ACTIVE | EXPIRED | REVOKED
  validFrom: Date;
  validUntil: Date;
  allowedDays: string[];
  timeFrom: string | null;
  timeUntil: string | null;
  maxUses: number | null;
  usedCount: number;
}

export interface PartyRuleInput {
  status: string; // ACTIVE | EXPIRED | CANCELLED
  validFrom: Date;
  validUntil: Date;
}

export function resolveGuestInviteDenyReason(
  invite: GuestInviteRuleInput,
  now: Date,
  currentDay: string,
  currentTime: string,
): VerifyDenyReason | null {
  // Only an explicit resident action produces REVOKED.
  if (invite.status === 'REVOKED') return 'REVOKED';

  // One-time passes are set to EXPIRED right after their last allowed use, so the
  // usage counter (not the status) tells us it was consumed rather than timed out.
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return 'MAX_USES_REACHED';

  if (now > invite.validUntil) return 'EXPIRED';
  // Any other non-ACTIVE status (e.g. expired by the cron job) is an expiry.
  if (invite.status !== 'ACTIVE') return 'EXPIRED';
  if (now < invite.validFrom) return 'NOT_STARTED';

  if (invite.type === 'FREQUENT') {
    if (invite.allowedDays.length > 0 && !invite.allowedDays.includes(currentDay)) {
      return 'WRONG_DAY';
    }
    if (invite.timeFrom && invite.timeUntil) {
      if (currentTime < invite.timeFrom || currentTime > invite.timeUntil) return 'OUTSIDE_HOURS';
    }
  }

  return null;
}

export function resolvePartyDenyReason(
  party: PartyRuleInput,
  slotPhone: string | null,
  now: Date,
): VerifyDenyReason | null {
  if (party.status === 'CANCELLED') return 'CANCELLED';
  if (now > party.validUntil) return 'EXPIRED';
  if (party.status !== 'ACTIVE') return 'EXPIRED';
  if (now < party.validFrom) return 'NOT_STARTED';
  if (!slotPhone) return 'UNCLAIMED_SLOT';
  return null;
}

/** Format a Date as e.g. "3 Oct, 6:30 PM" in IST for guard-facing messages. */
function formatIst(date: Date): string {
  try {
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toISOString();
  }
}

export function getVerifyDenyMessage(
  reason: string,
  ctx: {
    kind: 'GUEST' | 'PARTY';
    validFrom?: Date;
    validUntil?: Date;
    timeFrom?: string | null;
    timeUntil?: string | null;
  },
): string {
  switch (reason) {
    case 'REVOKED':
      return 'This invite has been revoked by the resident';
    case 'CANCELLED':
      return 'This party invite has been cancelled by the resident';
    case 'MAX_USES_REACHED':
      return 'This pass has already been used';
    case 'EXPIRED':
      return ctx.validUntil
        ? `This pass expired on ${formatIst(ctx.validUntil)}`
        : 'This pass has expired';
    case 'NOT_STARTED':
      return ctx.validFrom
        ? `This pass is not valid yet — it starts on ${formatIst(ctx.validFrom)}`
        : 'This pass is not valid yet';
    case 'WRONG_DAY':
      return 'This guest is not allowed today';
    case 'OUTSIDE_HOURS':
      return ctx.timeFrom && ctx.timeUntil
        ? `This guest is only allowed between ${ctx.timeFrom} - ${ctx.timeUntil}`
        : 'Outside allowed hours';
    case 'UNCLAIMED_SLOT':
      return 'This slot has not been claimed by a guest';
    default:
      return 'Access denied';
  }
}
