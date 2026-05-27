import { prisma } from '../utils/Client';
import { isFirebaseAvailable, getMessaging } from '../config/firebase';
import logger from '../utils/logger';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface FlatPushOptions {
  excludeUserIds?: string[];
}

class PushService {
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!isFirebaseAvailable()) {
      logger.debug('Push skipped: Firebase not available');
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fcmToken: true },
      });

      if (!user?.fcmToken) return;

      await this.sendMulticast([{ userId: user.id, fcmToken: user.fcmToken }], payload);
    } catch (error) {
      logger.error({ error, userId }, 'Push sendToUser failed');
    }
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!isFirebaseAvailable()) {
      logger.debug('Push skipped: Firebase not available');
      return;
    }

    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, fcmToken: { not: null } },
        select: { id: true, fcmToken: true },
      });

      if (users.length === 0) return;

      await this.sendMulticast(
        users.map((u) => ({ userId: u.id, fcmToken: u.fcmToken! })),
        payload
      );
    } catch (error) {
      logger.error({ error, userIds }, 'Push sendToUsers failed');
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
    if (!isFirebaseAvailable()) {
      logger.debug('Push skipped: Firebase not available');
      return;
    }

    try {
      const uniqueFlatIds = [...new Set(flatIds.filter(Boolean))];
      if (uniqueFlatIds.length === 0) return;

      const excludedIds = new Set(options.excludeUserIds ?? []);
      const memberships = await prisma.userFlatMembership.findMany({
        where: {
          flatId: { in: uniqueFlatIds },
          isActive: true,
          role: 'RESIDENT',
          user: {
            isActive: true,
            role: 'RESIDENT',
            fcmToken: { not: null },
          },
        },
        select: {
          user: { select: { id: true, fcmToken: true } },
        },
      });

      const residentMap = new Map<string, string>();
      for (const membership of memberships) {
        if (!membership.user.fcmToken || excludedIds.has(membership.user.id)) continue;
        residentMap.set(membership.user.id, membership.user.fcmToken);
      }

      const residents = [...residentMap.entries()].map(([id, fcmToken]) => ({ id, fcmToken }));
      if (residents.length === 0) return;

      await this.sendMulticast(
        residents.map((r) => ({ userId: r.id, fcmToken: r.fcmToken })),
        payload
      );
    } catch (error) {
      logger.error({ error, flatIds }, 'Push sendToFlats failed');
    }
  }

  async sendToSocietyStaff(
    societyId: string,
    roles: ('ADMIN' | 'SUPER_ADMIN' | 'GUARD' | 'RESIDENT')[],
    payload: PushPayload
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      logger.debug('Push skipped: Firebase not available');
      return;
    }

    try {
      const staff = await prisma.user.findMany({
        where: { societyId, isActive: true, role: { in: roles }, fcmToken: { not: null } },
        select: { id: true, fcmToken: true },
      });

      if (staff.length === 0) return;

      await this.sendMulticast(
        staff.map((s) => ({ userId: s.id, fcmToken: s.fcmToken! })),
        payload
      );
    } catch (error) {
      logger.error({ error, societyId, roles }, 'Push sendToSocietyStaff failed');
    }
  }

  private async sendMulticast(
    targets: { userId: string; fcmToken: string }[],
    payload: PushPayload
  ): Promise<void> {
    // Cast all data values to string — FCM rejects non-strings
    const stringData: Record<string, string> = {};
    if (payload.data) {
      for (const [key, value] of Object.entries(payload.data)) {
        stringData[key] = String(value);
      }
    }

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: stringData,
      tokens: targets.map((t) => t.fcmToken),
    };

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
            tokensToRemove.push(targets[idx].userId);
          }
        }
      });

      logger.debug({ successCount, failCount }, 'Push sent');

      // Clean up invalid tokens
      if (tokensToRemove.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: tokensToRemove } },
          data: { fcmToken: null },
        });
        logger.debug({ count: tokensToRemove.length }, 'Cleaned up invalid FCM tokens');
      }
    } catch (error) {
      logger.error({ error }, 'Push sendMulticast failed');
    }
  }
}

export const pushService = new PushService();
