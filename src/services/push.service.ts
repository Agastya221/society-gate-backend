import { prisma } from '../utils/Client';
import { isFirebaseAvailable, getMessaging } from '../config/firebase';
import { deliverInApp, type AlertTarget } from '../utils/socket';
import logger from '../utils/logger';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Loud, attention-grabbing alert (gate requests, emergencies...). Defaults from data.type. */
  urgent?: boolean;
}

interface FlatPushOptions {
  excludeUserIds?: string[];
}

/** Who gets an alert: the id used for in-app delivery, plus the push token when they have one. */
interface Recipient {
  id: string;
  fcmToken: string | null;
}

/**
 * Alert types that must catch the person's attention: loud channel, high priority, long ring,
 * full-screen alert when the app is open. Everything else is a normal notification.
 */
const URGENT_TYPES = new Set([
  'GATE_REQUEST',
  'GATE_APPROVED',
  'GATE_DENIED',
  'GATE_EXPIRED',
  'EMERGENCY',
  'EMERGENCY_ALERT',
  'SOS',
  'STAFF_BOOKING',
  'BOOKING_REQUEST',
]);

/** Android channel the apps create at start-up (importance max, custom ring, vibration). */
export const URGENT_CHANNEL_ID = 'gate-alert-v1';
export const URGENT_SOUND = 'gate_alert';
const URGENT_VIBRATION_MS = ['0', '700', '300', '700', '300', '700', '300', '700'];

export function buildPushMessage(
  alert: { title: string; body: string; data: Record<string, string>; urgent: boolean },
  tokens: string[],
) {
  return {
    notification: { title: alert.title, body: alert.body },
    data: alert.urgent ? { ...alert.data, urgent: '1' } : alert.data,
    tokens,
    android: alert.urgent
      ? {
          // Wake the phone now and drop it if it can't be delivered within a minute: a gate
          // request that arrives ten minutes late is worse than none.
          priority: 'high' as const,
          ttl: 60_000,
          notification: {
            channelId: URGENT_CHANNEL_ID,
            sound: URGENT_SOUND,
            priority: 'max' as const,
            visibility: 'public' as const,
            defaultSound: false,
            defaultVibrateTimings: false,
            vibrateTimingsMillis: URGENT_VIBRATION_MS.map(Number),
            ...(alert.data.entryRequestId ? { tag: `gate-${alert.data.entryRequestId}` } : {}),
          },
        }
      : { priority: 'high' as const },
  };
}

class PushService {
  async sendToStaff(domesticStaffId: string, payload: PushPayload): Promise<void> {
    try {
      const account = await prisma.staffAccount.findUnique({
        where: { domesticStaffId },
        select: { id: true, fcmToken: true },
      });
      if (!account) return;
      await this.deliver([{ id: account.id, fcmToken: account.fcmToken }], payload, 'staff');
    } catch (error) {
      logger.error({ error, domesticStaffId }, 'Alert sendToStaff failed');
    }
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fcmToken: true },
      });
      if (!user) return;
      await this.deliver([{ id: user.id, fcmToken: user.fcmToken }], payload);
    } catch (error) {
      logger.error({ error, userId }, 'Alert sendToUser failed');
    }
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fcmToken: true },
      });
      if (users.length === 0) return;
      await this.deliver(users.map((u) => ({ id: u.id, fcmToken: u.fcmToken })), payload);
    } catch (error) {
      logger.error({ error, userIds }, 'Alert sendToUsers failed');
    }
  }

  async sendToFlat(
    flatId: string,
    payload: PushPayload,
    options: FlatPushOptions = {}
  ): Promise<void> {
    return this.sendToFlats([flatId], payload, options);
  }

  async sendToFlats(
    flatIds: string[],
    payload: PushPayload,
    options: FlatPushOptions = {}
  ): Promise<void> {
    try {
      const uniqueFlatIds = [...new Set(flatIds.filter(Boolean))];
      if (uniqueFlatIds.length === 0) return;

      const excludedIds = new Set(options.excludeUserIds ?? []);
      const memberships = await prisma.userFlatMembership.findMany({
        where: {
          flatId: { in: uniqueFlatIds },
          isActive: true,
          role: 'RESIDENT',
          user: { isActive: true, role: 'RESIDENT' },
        },
        select: { user: { select: { id: true, fcmToken: true } } },
      });

      const residents = new Map<string, Recipient>();
      for (const membership of memberships) {
        if (excludedIds.has(membership.user.id)) continue;
        residents.set(membership.user.id, { id: membership.user.id, fcmToken: membership.user.fcmToken });
      }
      if (residents.size === 0) return;

      await this.deliver([...residents.values()], payload);
    } catch (error) {
      logger.error({ error, flatIds }, 'Alert sendToFlats failed');
    }
  }

  async sendToSocietyStaff(
    societyId: string,
    roles: ('ADMIN' | 'SUPER_ADMIN' | 'GUARD' | 'RESIDENT')[],
    payload: PushPayload
  ): Promise<void> {
    try {
      const staff = await prisma.user.findMany({
        where: { societyId, isActive: true, role: { in: roles } },
        select: { id: true, fcmToken: true },
      });
      if (staff.length === 0) return;
      await this.deliver(staff.map((s) => ({ id: s.id, fcmToken: s.fcmToken })), payload);
    } catch (error) {
      logger.error({ error, societyId, roles }, 'Alert sendToSocietyStaff failed');
    }
  }

  /**
   * The one delivery rule for every alert:
   *  1. If the person has the app open on screen, show it there (the app confirms it showed it).
   *  2. Everyone not reached that way gets a push notification instead.
   */
  private async deliver(
    recipients: Recipient[],
    payload: PushPayload,
    kind: AlertTarget = 'user'
  ): Promise<void> {
    // Cast all data values to string — FCM and the socket payload both want plain strings
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload.data ?? {})) data[key] = String(value);

    const urgent = payload.urgent ?? URGENT_TYPES.has(data.type ?? '');
    const alert = { title: payload.title, body: payload.body, data, urgent };

    const reached = await Promise.all(recipients.map((r) => deliverInApp(kind, r.id, alert)));
    const needPush = recipients.filter((r, i) => !reached[i] && r.fcmToken);

    const inApp = reached.filter(Boolean).length;
    if (inApp > 0 || needPush.length > 0) {
      logger.debug({ type: data.type, urgent, inApp, push: needPush.length, total: recipients.length }, 'Alert routed');
    }
    if (needPush.length === 0) return;

    if (!isFirebaseAvailable()) {
      logger.debug('Push skipped: Firebase not available');
      return;
    }
    await this.sendPush(needPush, alert, kind);
  }

  private async sendPush(
    targets: Recipient[],
    alert: { title: string; body: string; data: Record<string, string>; urgent: boolean },
    kind: AlertTarget
  ): Promise<void> {
    const message = buildPushMessage(alert, targets.map((t) => t.fcmToken!) as string[]);

    try {
      const batchResponse = await getMessaging().sendEachForMulticast(message);

      let successCount = 0;
      let failCount = 0;
      const tokensToRemove: string[] = [];

      batchResponse.responses.forEach((resp, idx) => {
        if (resp.success) {
          successCount++;
        } else {
          failCount++;
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            tokensToRemove.push(targets[idx].id);
          }
        }
      });

      logger.debug({ successCount, failCount, urgent: alert.urgent }, 'Push sent');

      // Clean up invalid tokens
      if (tokensToRemove.length > 0) {
        if (kind === 'staff') {
          await prisma.staffAccount.updateMany({ where: { id: { in: tokensToRemove } }, data: { fcmToken: null } });
        } else {
          await prisma.user.updateMany({ where: { id: { in: tokensToRemove } }, data: { fcmToken: null } });
        }
        logger.debug({ count: tokensToRemove.length }, 'Cleaned up invalid FCM tokens');
      }
    } catch (error) {
      logger.error({ error }, 'Push sendMulticast failed');
    }
  }
}

export const pushService = new PushService();
