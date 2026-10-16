import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { clampPagination } from '../../utils/scope';
import { isOwnedUploadKey } from '../../utils/s3';
import { eventBus } from '../../utils/eventBus';
import { emitToUser, SOCKET_EVENTS } from '../../utils/socket';
import logger from '../../utils/logger';
import { notificationService } from '../notification/notification.service';
import { societySettingsService, type AutoApprovalSettings } from '../settings/society-settings.service';
import type { Prisma } from '../../types';
import {
  EntryType,
  EntryRequestStatus,
  ProviderTag,
} from '../../../prisma/generated/prisma/enums';

const EXPIRY_MINUTES = 15;
export const READY_WINDOW_MS = 60 * 60 * 1000;
// A retried POST (the guard app times out after 25 s) must not create a second request
const DUPLICATE_CREATE_WINDOW_MS = 30_000;
// How long a resident-rejected / unanswered request stays visible in the gate queue
const STOPPED_WINDOW_MS = 30 * 60 * 1000;
const QUEUE_LIST_LIMIT = 50;

/** Entry types an admin can auto-approve in Society Settings → autoApproval flag. */
const AUTO_APPROVAL_FLAG: Partial<Record<EntryType, keyof AutoApprovalSettings>> = {
  DELIVERY: 'delivery',
  CAB: 'cab',
  DOMESTIC_STAFF: 'domesticStaff',
};

export function isAutoApprovedType(type: EntryType, settings: AutoApprovalSettings): boolean {
  const flag = AUTO_APPROVAL_FLAG[type];
  return flag ? settings[flag] === true : false;
}

export const AUTO_APPROVED_BY_NAME = 'Auto-approved';
export const ENTRY_REQUEST_CANCELLED_REASON = 'Cancelled by guard';
export const ENTRY_REQUEST_STOPPED_REASON = 'Stopped by guard';
export const ENTRY_REQUEST_LEFT_REASON = 'Visitor left before entering';
export const ENTRY_REQUEST_APPROVAL_EXPIRED_REASON = 'Approval expired before arrival';

/** Stops the guard made themselves — the guard already knows, so the gate queue hides them. */
const GUARD_OWN_STOP_REASONS = [
  ENTRY_REQUEST_CANCELLED_REASON,
  ENTRY_REQUEST_LEFT_REASON,
  ENTRY_REQUEST_APPROVAL_EXPIRED_REASON,
  ENTRY_REQUEST_STOPPED_REASON,
];

interface CreateEntryRequestData {
  type: EntryType;
  flatId?: string;
  flatIds?: string[];
  visitorName?: string;
  visitorPhone?: string;
  providerTag?: ProviderTag;
  purpose?: string;
  photoKey?: string;
}

interface RequestTargetInfo {
  targetId?: string;
  flatId: string;
  flatNumber: string;
  blockName: string | null;
}

export interface CreateEntryRequestResult {
  entryRequest: Awaited<ReturnType<typeof prisma.entryRequest.findUniqueOrThrow>>;
}

export class EntryRequestService {
  private static readonly GUARD_OVERRIDE_WAIT_MS = 45_000;
  // ============================================
  // MAIN: CREATE ENTRY REQUEST
  // MyGate-style tiered trust system:
  //  Tier 1 — Standing auto-approve rule match  → auto-enter, notify after
  //  Tier 2 — Expected delivery match           → auto-enter, notify after
  //  Tier 3 — No match                          → PENDING, guard notifies resident for approval
  // ============================================
  async createEntryRequest(
    data: CreateEntryRequestData,
    guardId: string
  ): Promise<{ entryRequest: object; autoApproved: boolean }> {
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: {
        societyId: true,
        role: true,
        society: { select: { name: true } },
      },
    });

    if (!guard || guard.role !== 'GUARD') {
      throw new AppError('Only guards can create entry requests', 403);
    }

    if (!guard.societyId) {
      throw new AppError('Guard must be assigned to a society', 400);
    }

    // Only a key this guard uploaded (entry-photos/<guardId>/<file>) — never another user's object
    if (data.photoKey !== undefined && data.photoKey !== null && data.photoKey !== '' &&
        !isOwnedUploadKey(data.photoKey, guardId, ['entry-photos'])) {
      throw new AppError('Invalid photo key', 400);
    }

    const requestedFlatIds = [
      ...new Set([
        ...(data.flatId ? [data.flatId] : []),
        ...(data.flatIds ?? []),
      ]),
    ];

    if (requestedFlatIds.length === 0) {
      throw new AppError('At least one flat is required', 400);
    }
    // One resident must never be able to approve entry for another flat.
    if (requestedFlatIds.length > 1) {
      throw new AppError('Create a separate entry request for each flat', 400);
    }

    const flats = await prisma.flat.findMany({
      where: { id: { in: requestedFlatIds }, isActive: true },
      select: {
        id: true,
        societyId: true,
        flatNumber: true,
        block: { select: { name: true } },
      },
    });

    const flatById = new Map(flats.map((flat) => [flat.id, flat]));
    const missingFlatIds = requestedFlatIds.filter((flatId) => !flatById.has(flatId));
    if (missingFlatIds.length > 0) {
      throw new AppError(`Flat not found: ${missingFlatIds.join(', ')}`, 404);
    }

    const orderedFlats = requestedFlatIds.map((flatId) => flatById.get(flatId)!);
    const crossSocietyFlat = orderedFlats.find((flat) => flat.societyId !== guard.societyId);
    if (crossSocietyFlat) {
      throw new AppError('All flats must belong to the guard society', 400);
    }

    const primaryFlat = orderedFlats[0];

    // A retried POST (guard app timeout / double-tap) must not create a second request
    // or fire a second resident push — return the one already in flight.
    const duplicate = await prisma.entryRequest.findFirst({
      where: {
        guardId,
        flatId: primaryFlat.id,
        type: data.type,
        visitorName: data.visitorName ?? null,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - DUPLICATE_CREATE_WINDOW_MS) },
      },
      include: this.getInclude(),
      orderBy: { createdAt: 'desc' },
    });
    if (duplicate) {
      return { entryRequest: this.formatEntryRequest(duplicate), autoApproved: false };
    }

    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    const entryRequest = await prisma.entryRequest.create({
      data: {
        type: data.type,
        visitorName: data.visitorName,
        visitorPhone: data.visitorPhone,
        providerTag: data.providerTag,
        purpose: data.purpose,
        photoKey: data.photoKey || undefined,
        flatId: primaryFlat.id,
        societyId: guard.societyId,
        guardId,
        expiresAt,
        status: 'PENDING',
        targets: {
          create: orderedFlats.map((flat) => ({
            flatId: flat.id,
            societyId: guard.societyId!,
          })),
        },
      },
      include: this.getInclude(),
    });

    // Society Settings auto-approval (DELIVERY / CAB / DOMESTIC_STAFF, default off):
    // approve immediately through the normal approval path (status -> APPROVED). The
    // guard still has to admit the visitor at the gate to create the CHECKED_IN Entry —
    // this just skips the resident prompt. Residents get an informational "let in"
    // notification instead of an approval prompt (entry-request.created is NOT emitted).
    let autoApprove = false;
    try {
      const { autoApproval } = await societySettingsService.getConfiguredRules(guard.societyId);
      autoApprove = isAutoApprovedType(data.type, autoApproval);
    } catch (err) {
      logger.error({ err, societyId: guard.societyId }, 'Auto-approval settings lookup failed; falling back to manual approval');
    }

    if (autoApprove) {
      const approved = await this.approveEntryRequest(entryRequest.id, guardId, { autoApproved: true });
      return { entryRequest: approved, autoApproved: true };
    }

    const targetInfos = this.getTargetInfos(entryRequest);

    eventBus.emit('entry-request.created', {
      entryRequestId: entryRequest.id,
      flatId: primaryFlat.id,
      flatIds: targetInfos.map((target) => target.flatId),
      flats: targetInfos,
      societyId: guard.societyId,
      societyName: guard.society?.name ?? 'Society',
      guardId,
      visitorName: data.visitorName,
      providerTag: data.providerTag,
      purpose: data.purpose,
      type: data.type,
    });

    return { entryRequest: this.formatEntryRequest(entryRequest), autoApproved: false };
  }

  // ============================================
  // GET ENTRY REQUESTS
  // ============================================
  async getEntryRequests(
    userId: string,
    filters: {
      status?: EntryRequestStatus;
      flatId?: string;
      page?: number;
      limit?: number;
      awaitingEntry?: boolean;
      order?: 'oldest' | 'newest';
      since?: string;
    }
  ) {
    const { status, flatId } = filters;
    const { page, limit, skip } = clampPagination(filters.page, filters.limit, 20);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        societyId: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const where: Prisma.EntryRequestWhereInput = {};

    if (user.role === 'RESIDENT') {
      const visibleFlatIds = this.getUserFlatIds(user);
      if (visibleFlatIds.length === 0) {
        where.id = '__no_access__';
      } else if (flatId) {
        if (!visibleFlatIds.includes(flatId)) {
          throw new AppError('Access denied for this flat', 403);
        }
        where.OR = [{ flatId }, { targets: { some: { flatId } } }];
      } else {
        where.OR = [
          { flatId: { in: visibleFlatIds } },
          { targets: { some: { flatId: { in: visibleFlatIds } } } },
        ];
      }
    } else if (user.role === 'ADMIN' || user.role === 'GUARD') {
      // Never fall through to an unscoped query for a society-less admin/guard
      where.societyId = user.societyId ?? '__no_access__';
    } else if (user.role !== 'SUPER_ADMIN') {
      where.id = '__no_access__';
    }

    if (status) where.status = status;
    if (filters.since) where.createdAt = { gte: new Date(filters.since) };
    if (filters.awaitingEntry) {
      where.status = 'APPROVED';
      where.entryId = null;
      where.approvedAt = { gte: new Date(Date.now() - READY_WINDOW_MS) };
    }
    if (flatId && user.role !== 'RESIDENT') {
      where.OR = [{ flatId }, { targets: { some: { flatId } } }];
    }

    const [rawRequests, total] = await Promise.all([
      prisma.entryRequest.findMany({
        where,
        include: this.getInclude(),
        orderBy: { createdAt: filters.order === 'oldest' ? 'asc' : 'desc' },
        skip,
        take: limit,
      }),
      prisma.entryRequest.count({ where }),
    ]);

    return {
      entryRequests: rawRequests.map((request) => this.formatEntryRequest(request)),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // GET SINGLE ENTRY REQUEST
  // ============================================
  async getEntryRequestById(entryRequestId: string, userId: string) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        societyId: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const targetFlatIds = this.getTargetInfos(entryRequest).map((target) => target.flatId);
    const isGuard =
      entryRequest.guardId === userId ||
      (user.role === 'GUARD' && user.societyId === entryRequest.societyId);
    const isFlatResident = this.getUserFlatIds(user).some((flatId) => targetFlatIds.includes(flatId));
    const isSocietyAdmin =
      user.role === 'ADMIN' && user.societyId === entryRequest.societyId;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    if (!isGuard && !isFlatResident && !isSocietyAdmin && !isSuperAdmin) {
      throw new AppError('Access denied', 403);
    }

    return this.formatEntryRequest(entryRequest);
  }

  // ============================================
  // APPROVE ENTRY REQUEST
  // ============================================
  async approveEntryRequest(entryRequestId: string, userId: string, opts: { autoApproved?: boolean } = {}) {
    const autoApproved = opts.autoApproved === true;
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        role: true,
        societyId: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!approver) {
      throw new AppError('User not found', 404);
    }

    const targetInfos = this.getTargetInfos(entryRequest);
    if (targetInfos.length !== 1) {
      throw new AppError('Each flat needs a separate approval', 400);
    }
    // Guards may override ("Allow Anyway") — but only for requests in their own society
    const isSocietyGuard = approver.role === 'GUARD' && approver.societyId === entryRequest.societyId;
    const approverFlatIds = this.getUserFlatIds(approver);
    const canApprove = isSocietyGuard || targetInfos.some((target) => approverFlatIds.includes(target.flatId));
    if (!canApprove) {
      throw new AppError('Only linked flat residents or society guards can approve entry requests', 403);
    }
    if (isSocietyGuard && !autoApproved &&
        Date.now() - entryRequest.createdAt.getTime() < EntryRequestService.GUARD_OVERRIDE_WAIT_MS) {
      throw new AppError('Wait 45 seconds for the resident before allowing entry yourself', 403);
    }

    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    if (new Date() > entryRequest.expiresAt) {
      await prisma.entryRequest.updateMany({
        where: { id: entryRequestId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('Entry request has expired', 400);
    }

    // Approval grants permission. Only the guard's later admit action records
    // physical entry. Claim PENDING atomically so two residents cannot approve
    // the same request and emit two successful decisions.
    const claimed = await prisma.entryRequest.updateMany({
      where: { id: entryRequestId, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError('Entry request is no longer pending', 409);
    const updatedRequest = await prisma.entryRequest.findUniqueOrThrow({
      where: { id: entryRequestId }, include: this.getInclude(),
    });

    const flatLabel = this.getFlatLabelList(targetInfos);
    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'APPROVED',
      flatNumber: flatLabel,
      flatIds: targetInfos.map((target) => target.flatId),
      approvedBy: updatedRequest.approvedBy?.name,
    });

    eventBus.emit('entry-request.approved', {
      entryRequestId,
      flatId: entryRequest.flatId,
      flatIds: targetInfos.map((target) => target.flatId),
      flats: targetInfos,
      societyId: entryRequest.societyId,
      guardId: entryRequest.guardId,
      visitorName: entryRequest.visitorName || 'Visitor',
      visitorType: entryRequest.type,
      approvedById: userId,
      approvedByName: autoApproved
        ? AUTO_APPROVED_BY_NAME
        : updatedRequest.approvedBy?.name ?? approver.name ?? 'A resident',
      autoApproved,
    });

    return this.formatEntryRequest(updatedRequest);
  }

  /** Guard confirms that an approved person actually passed through the gate. */
  async admitEntryRequest(entryRequestId: string, guardId: string) {
    const guard = await prisma.user.findUnique({
      where: { id: guardId }, select: { role: true, societyId: true },
    });
    if (guard?.role !== 'GUARD' || !guard.societyId) throw new AppError('Guard access required', 403);
    const societyId = guard.societyId;

    const admitted = await prisma.$transaction(async (tx) => {
      const request = await tx.entryRequest.findFirst({
        where: { id: entryRequestId, societyId },
        include: this.getInclude(),
      });
      if (!request) throw new AppError('Entry request not found', 404);
      if (request.status !== 'APPROVED' || request.entryId) {
        throw new AppError('Entry has already been recorded or is not approved', 409);
      }
      if (!request.approvedAt || Date.now() - request.approvedAt.getTime() > READY_WINDOW_MS) {
        throw new AppError('Approval expired. Ask the resident again.', 409);
      }
      const targets = this.getTargetInfos(request);
      if (targets.length !== 1) throw new AppError('Each flat needs a separate entry request', 400);

      const now = new Date();
      const entry = await tx.entry.create({
        data: {
          type: request.type,
          visitorName: request.visitorName || 'Visitor',
          visitorPhone: request.visitorPhone,
          visitorPhoto: request.photoKey,
          companyName: request.providerTag,
          purpose: request.purpose,
          flatId: targets[0].flatId,
          societyId: request.societyId,
          createdById: guardId,
          approvedById: request.approvedById,
          approvedAt: request.approvedAt,
          status: 'CHECKED_IN',
          checkInTime: now,
        },
      });
      const claimed = await tx.entryRequest.updateMany({
        where: { id: entryRequestId, status: 'APPROVED', entryId: null },
        data: { entryId: entry.id },
      });
      if (claimed.count !== 1) throw new AppError('Entry was recorded by another guard', 409);
      if (targets[0].targetId) {
        await tx.entryRequestTarget.update({
          where: { id: targets[0].targetId }, data: { entryId: entry.id },
        });
      }
      return { entry, requestId: entryRequestId };
    });
    eventBus.emit('entry-request.admitted', {
      entryRequestId,
      societyId: guard.societyId,
      flatId: admitted.entry.flatId!,
      guardId,
      visitorName: admitted.entry.visitorName,
      visitorType: admitted.entry.type,
    });
    return admitted;
  }

  /** Clears an approved visitor who left the gate without entering. */
  async markNoShow(entryRequestId: string, guardId: string) {
    const guard = await prisma.user.findUnique({
      where: { id: guardId }, select: { role: true, societyId: true },
    });
    if (guard?.role !== 'GUARD' || !guard.societyId) throw new AppError('Guard access required', 403);
    const existing = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId }, include: this.getInclude(),
    });
    const changed = await prisma.entryRequest.updateMany({
      where: { id: entryRequestId, societyId: guard.societyId, status: 'APPROVED', entryId: null },
      data: { status: 'EXPIRED', rejectionReason: ENTRY_REQUEST_LEFT_REASON },
    });
    if (changed.count !== 1) throw new AppError('Request is no longer waiting at the gate', 409);
    const updatedRequest = await prisma.entryRequest.findUniqueOrThrow({
      where: { id: entryRequestId }, include: this.getInclude(),
    });

    if (existing) {
      const targetInfos = this.getTargetInfos(existing);
      eventBus.emit('entry-request.no-show', {
        entryRequestId,
        flatId: existing.flatId,
        flatIds: targetInfos.map((target) => target.flatId),
        flats: targetInfos,
        societyId: guard.societyId,
        guardId,
        visitorName: existing.visitorName || 'Visitor',
        visitorType: existing.type,
      });
    }

    return this.formatEntryRequest(updatedRequest);
  }

  // ============================================
  // REJECT ENTRY REQUEST
  // ============================================
  async rejectEntryRequest(
    entryRequestId: string,
    userId: string,
    reason?: string
  ) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const rejecter = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        role: true,
        societyId: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!rejecter) {
      throw new AppError('User not found', 404);
    }

    const targetInfos = this.getTargetInfos(entryRequest);
    if (targetInfos.length !== 1) throw new AppError('Each flat needs a separate decision', 400);
    const isSocietyGuard = rejecter.role === 'GUARD' && rejecter.societyId === entryRequest.societyId;
    const rejecterFlatIds = this.getUserFlatIds(rejecter);
    const canReject = isSocietyGuard || targetInfos.some((target) => rejecterFlatIds.includes(target.flatId));
    if (!canReject) {
      throw new AppError('Only linked flat residents or society guards can reject entry requests', 403);
    }

    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    // A guard rejecting with no reason is "stopping" the visitor at the gate, not a
    // resident decision — store the fixed reason so the gate queue can tell the two apart.
    const effectiveReason = reason || (isSocietyGuard ? ENTRY_REQUEST_STOPPED_REASON : reason);

    const changed = await prisma.entryRequest.updateMany({
      where: { id: entryRequestId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: effectiveReason,
      },
    });
    if (changed.count !== 1) throw new AppError('Entry request is no longer pending', 409);
    const updatedRequest = await prisma.entryRequest.findUniqueOrThrow({
      where: { id: entryRequestId }, include: this.getInclude(),
    });

    const flatLabel = this.getFlatLabelList(targetInfos);
    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'REJECTED',
      flatNumber: flatLabel,
      flatIds: targetInfos.map((target) => target.flatId),
      reason: effectiveReason,
    });

    eventBus.emit('entry-request.rejected', {
      entryRequestId,
      flatId: entryRequest.flatId,
      flatIds: targetInfos.map((target) => target.flatId),
      flats: targetInfos,
      societyId: entryRequest.societyId,
      guardId: entryRequest.guardId,
      visitorName: entryRequest.visitorName || 'Visitor',
      visitorType: entryRequest.type,
      rejectedById: userId,
      rejectedByName: rejecter.name ?? 'A resident',
      reason: effectiveReason,
    });

    return this.formatEntryRequest(updatedRequest);
  }

  // ============================================
  // CANCEL ENTRY REQUEST (Guard withdraws a pending request)
  // EntryRequestStatus has no CANCELLED value, so this is stored as REJECTED
  // with a fixed reason. Residents are told the request was withdrawn (no
  // "rejected by" push, since nobody at the flat rejected it).
  // ============================================
  async cancelEntryRequest(entryRequestId: string, guardId: string) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: { role: true, societyId: true },
    });

    if (!guard || guard.role !== 'GUARD' || guard.societyId !== entryRequest.societyId) {
      throw new AppError('Only guards of this society can cancel entry requests', 403);
    }

    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    // Conditional update so a resident approving at the same instant can't be overwritten
    const result = await prisma.entryRequest.updateMany({
      where: { id: entryRequestId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: ENTRY_REQUEST_CANCELLED_REASON,
      },
    });

    if (result.count === 0) {
      throw new AppError('Entry request is no longer pending', 400);
    }

    const updatedRequest = await prisma.entryRequest.findUniqueOrThrow({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    const targetInfos = this.getTargetInfos(entryRequest);
    const flatIds = targetInfos.map((target) => target.flatId);

    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'REJECTED',
      flatNumber: this.getFlatLabelList(targetInfos),
      flatIds,
      reason: ENTRY_REQUEST_CANCELLED_REASON,
    });

    notificationService.sendToFlats(flatIds, {
      type: 'ENTRY_REQUEST',
      title: 'Request withdrawn',
      message: entryRequest.visitorName
        ? `The gate withdrew the entry request for ${entryRequest.visitorName}`
        : 'The gate withdrew an entry request',
      data: {
        entryRequestId,
        societyId: entryRequest.societyId,
        flatIds,
        flatLabels: targetInfos.map((target) => target.flatNumber),
        status: 'REJECTED',
        reason: ENTRY_REQUEST_CANCELLED_REASON,
      },
      referenceId: entryRequestId,
      referenceType: 'EntryRequest',
      societyId: entryRequest.societyId,
    }).catch((err: unknown) => logger.error({ err }, 'Failed to send entry request cancelled notification'));

    return this.formatEntryRequest(updatedRequest);
  }

  // ============================================
  // EXPIRE PENDING REQUESTS (cron job)
  // ============================================
  async expirePendingRequests(): Promise<{ count: number }> {
    const result = await prisma.entryRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Auto-expired entry requests');
    }

    return { count: result.count };
  }

  // ============================================
  // GET PENDING COUNT FOR GUARD
  // ============================================
  async getPendingCountForGuard(guardId: string): Promise<number> {
    return prisma.entryRequest.count({
      where: {
        guardId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
  }

  // ============================================
  // GATE QUEUE (Guard home screen — one call instead of three polls)
  // ============================================
  async getGateQueue(guardId: string) {
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: { role: true, societyId: true },
    });
    if (!guard || guard.role !== 'GUARD' || !guard.societyId) {
      throw new AppError('Guard must be assigned to a society', 403);
    }
    const societyId = guard.societyId;
    const now = new Date();

    const [waitingRaw, readyRaw, stoppedRaw, checkedInCount, openStaffCount] = await Promise.all([
      prisma.entryRequest.findMany({
        where: { societyId, status: 'PENDING', expiresAt: { gt: now } },
        include: this.getInclude(),
        orderBy: { createdAt: 'asc' },
        take: QUEUE_LIST_LIMIT,
      }),
      prisma.entryRequest.findMany({
        where: {
          societyId,
          status: 'APPROVED',
          entryId: null,
          approvedAt: { gte: new Date(now.getTime() - READY_WINDOW_MS) },
        },
        include: this.getInclude(),
        orderBy: { createdAt: 'asc' },
        take: QUEUE_LIST_LIMIT,
      }),
      prisma.entryRequest.findMany({
        where: {
          societyId,
          status: { in: ['REJECTED', 'EXPIRED'] },
          createdAt: { gte: new Date(now.getTime() - STOPPED_WINDOW_MS) },
          NOT: { rejectionReason: { in: GUARD_OWN_STOP_REASONS } },
        },
        include: this.getInclude(),
        orderBy: { createdAt: 'desc' },
        take: QUEUE_LIST_LIMIT,
      }),
      prisma.entry.count({ where: { societyId, status: 'CHECKED_IN' } }),
      prisma.staffAttendance.count({ where: { societyId, checkOutTime: null } }),
    ]);

    return {
      waiting: waitingRaw.map((request) => this.formatEntryRequest(request)),
      ready: readyRaw.map((request) => this.formatEntryRequest(request)),
      stopped: stoppedRaw.map((request) => this.formatEntryRequest(request)),
      insideCount: checkedInCount + openStaffCount,
      serverTime: now.toISOString(),
    };
  }

  private getInclude() {
    return {
      flat: {
        select: {
          id: true,
          flatNumber: true,
          block: { select: { name: true } },
        },
      },
      targets: {
        include: {
          flat: {
            select: {
              id: true,
              flatNumber: true,
              block: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      guard: { select: { id: true, name: true, phone: true } },
      approvedBy: { select: { id: true, name: true } },
    };
  }

  private getUserFlatIds(user: { flatId?: string | null; flatMemberships?: { flatId: string | null }[] }) {
    const membershipFlatIds = user.flatMemberships
      ?.map((membership) => membership.flatId)
      .filter((flatId): flatId is string => Boolean(flatId)) ?? [];

    return [...new Set([...(user.flatId ? [user.flatId] : []), ...membershipFlatIds])];
  }

  private getTargetInfos(entryRequest: {
    flatId: string;
    flat?: { id: string; flatNumber: string; block?: { name: string } | null } | null;
    targets?: {
      id: string;
      flatId: string;
      flat: { id: string; flatNumber: string; block?: { name: string } | null };
    }[];
  }): RequestTargetInfo[] {
    if (entryRequest.targets && entryRequest.targets.length > 0) {
      return entryRequest.targets.map((target) => ({
        targetId: target.id,
        flatId: target.flatId,
        flatNumber: target.flat.flatNumber,
        blockName: target.flat.block?.name ?? null,
      }));
    }

    return [
      {
        flatId: entryRequest.flatId,
        flatNumber: entryRequest.flat?.flatNumber ?? '',
        blockName: entryRequest.flat?.block?.name ?? null,
      },
    ];
  }

  private getFlatLabelList(targetInfos: RequestTargetInfo[]) {
    return targetInfos
      .map((target) => target.blockName
        ? `${target.blockName} ${target.flatNumber}`
        : target.flatNumber
      )
      .join(', ');
  }

  private formatEntryRequest<T extends { flat?: unknown; targets?: unknown[]; flatId: string }>(
    entryRequest: T
  ) {
    const targetInfos = this.getTargetInfos(entryRequest as Parameters<typeof this.getTargetInfos>[0]);

    return {
      ...entryRequest,
      flat: {
        number: (entryRequest as { flat?: { flatNumber?: string } }).flat?.flatNumber ?? '',
        block: (entryRequest as { flat?: { block?: { name: string } | null } }).flat?.block ?? null,
      },
      flatIds: targetInfos.map((target) => target.flatId),
      targetFlats: targetInfos.map((target) => ({
        id: target.flatId,
        flatNumber: target.flatNumber,
        blockName: target.blockName,
      })),
      flatLabel: this.getFlatLabelList(targetInfos),
    };
  }
}

export const entryRequestService = new EntryRequestService();
