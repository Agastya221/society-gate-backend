import crypto from 'crypto';
import { prisma } from './Client';

// No ambiguous characters: removed 0/O, 1/I/L
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PASSCODE_LENGTH = 6;
const MAX_RETRIES = 10;

function generateRandomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

/**
 * Generate a globally unique 6-char passcode.
 * Checks uniqueness across GuestInvite.passcode AND PartySlot.code.
 */
export async function generateUniquePasscode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateRandomCode(PASSCODE_LENGTH);

    const [guestExists, slotExists] = await Promise.all([
      prisma.guestInvite.findUnique({ where: { passcode: code }, select: { id: true } }),
      prisma.partySlot.findUnique({ where: { code }, select: { id: true } }),
    ]);

    if (!guestExists && !slotExists) return code;
  }
  throw new Error('Failed to generate unique passcode after max retries');
}

/**
 * Generate a unique 8-char invite code for Party invites (e.g. "GRP-A1B2").
 */
export async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const suffix = generateRandomCode(4);
    const code = `GRP-${suffix}`;

    const exists = await prisma.partyInvite.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error('Failed to generate unique invite code after max retries');
}
