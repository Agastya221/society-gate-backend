import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';

// ============================================
// SETTINGS SUMMARY SERVICE
// GET /api/v1/auth/resident-app/settings-summary
// Works for both onboarding and approved residents.
// ============================================

export class SettingsService {
  async getResidentSettingsSummary(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        flat: {
          include: {
            block: true,
            society: true,
          },
        },
        society: true,
        onboardingRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const flat = user.flat;
    const society = flat?.society ?? user.society;

    // ── Household counts (only when a flat is assigned) ──
    let familyCount = 0;
    let vehicleCount = 0;
    let dailyHelpCount = 0;
    let dailyHelpPreviewName: string | null = null;

    if (flat) {
      [familyCount, vehicleCount] = await Promise.all([
        // Count only explicitly linked family members (via primaryResidentId),
        // excluding the requesting user so a family member doesn't count themselves.
        prisma.user.count({
          where: {
            flatId: flat.id,
            role: 'RESIDENT',
            isActive: true,
            primaryResidentId: { not: null },
            id: { not: userId },
          },
        }),
        // status:ACTIVE = admin-approved; isActive guards against soft-deleted records
        prisma.vehicle.count({
          where: {
            flatId: flat.id,
            status: 'ACTIVE',
            isActive: true,
          },
        }),
      ]);

      // Filter both the assignment and the staff record — staff soft-delete only
      // flips DomesticStaff.isActive, leaving assignments untouched.
      const activeAssignments = await prisma.staffFlatAssignment.findMany({
        where: {
          flatId: flat.id,
          isActive: true,
          domesticStaff: { isActive: true },
        },
        select: {
          domesticStaff: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      dailyHelpCount = activeAssignments.length;
      dailyHelpPreviewName = activeAssignments[0]?.domesticStaff?.name ?? null;
    }

    // ── Unread notification count ──
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    // ── Profile completion (6 equal checks) ──
    const checks: Record<string, boolean> = {
      name: !!(user.name && user.name.trim().length > 0),
      email: !!user.email,
      photoUrl: !!user.photoUrl,
      society: !!user.societyId,
      flat: !!user.flatId,
      approval: user.isActive,
    };

    const completedCount = Object.values(checks).filter(Boolean).length;
    const percentage = Math.round((completedCount / 6) * 100);
    const missingFields = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([key]) => key);

    // ── Flat / address ──
    let flatPayload: object | null = null;
    if (flat) {
      const parts = [
        flat.floor ? `Floor ${flat.floor}` : null,
        flat.flatNumber ? `Flat ${flat.flatNumber}` : null,
        flat.block?.name ?? null,
        society?.name ?? null,
        society?.address ?? null,
        society?.city ?? null,
        society?.state ?? null,
        society?.pincode ?? null,
      ].filter(Boolean) as string[];

      flatPayload = {
        id: flat.id,
        flatNumber: flat.flatNumber,
        floor: flat.floor ?? null,
        blockName: flat.block?.name ?? null,
        societyName: society?.name ?? null,
        formattedAddress: parts.join(', '),
      };
    }

    // ── Subscription ──
    let subscriptionPayload: object | null = null;
    if (society) {
      subscriptionPayload = {
        cycle: society.subscriptionCycle,
        paymentStatus: society.paymentStatus,
        lastPaidDate: society.lastPaidDate ?? null,
        nextDueDate: society.nextDueDate,
      };
    }

    return {
      profile: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email ?? null,
        photoUrl: user.photoUrl ?? null,
        isActive: user.isActive,
        onboardingStatus: user.onboardingRequests[0]?.status ?? 'NOT_STARTED',
      },
      completion: {
        percentage,
        missingFields,
      },
      flat: flatPayload,
      household: {
        familyCount,
        vehicleCount,
        dailyHelpCount,
        dailyHelpPreviewName,
      },
      notifications: {
        unreadCount,
      },
      subscription: subscriptionPayload,
    };
  }
}
