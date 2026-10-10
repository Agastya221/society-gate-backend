import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { findInSociety, clampPagination } from '../../utils/scope';
import type { NoticeFilters, Prisma } from '../../types';
import type { CreateNoticeInput, UpdateNoticeInput } from './notice.schemas';

// Maps internal role enum to a display label shown to residents
function roleToPostedBy(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'Society Manager',
    SUPER_ADMIN: 'Platform Admin',
  };
  return labels[role] ?? 'Management';
}

function formatNotice(notice: {
  createdBy?: { id: string; name: string; role: string } | null;
  [key: string]: unknown;
}) {
  const { createdBy, ...rest } = notice;
  return {
    ...rest,
    postedBy: createdBy ? roleToPostedBy(createdBy.role) : 'Management',
  };
}

export class NoticeService {
  async createNotice(data: CreateNoticeInput, createdById: string, societyId: string) {
    const notice = await prisma.notice.create({
      data: {
        type: data.type,
        priority: data.priority,
        title: data.title,
        description: data.description,
        images: data.images,
        documents: data.documents,
        isUrgent: data.isUrgent,
        isPinned: data.isPinned,
        publishAt: data.publishAt,
        expiresAt: data.expiresAt,
        societyId,
        createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        society: { select: { id: true, name: true } },
      },
    });

    return notice;
  }

  async getNotices(filters: NoticeFilters) {
    const { societyId, type, priority, isPinned, isActive = true, includeExpired = false } = filters;
    const { page, limit, skip } = clampPagination(filters.page, filters.limit, 20);

    const where: Prisma.NoticeWhereInput = { societyId };
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (isPinned !== undefined) where.isPinned = isPinned;
    if (isActive !== undefined) where.isActive = isActive;

    // Only show published notices
    const now = new Date();
    where.publishAt = { lte: now };

    // Hide notices past their expiry (no expiresAt = never expires) unless an admin asked for them
    if (!includeExpired) {
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
    }

    const [notices, total] = await Promise.all([
      prisma.notice.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: [
          { isPinned: 'desc' },
          { publishAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.notice.count({ where }),
    ]);

    return {
      notices: notices.map(formatNotice),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getNoticeById(noticeId: string, societyId: string, isAdmin = false) {
    const notice = await prisma.notice.findFirst({
      where: {
        id: noticeId,
        societyId,
        // Non-admins only see notices that are live (active and already published)
        ...(isAdmin ? {} : { isActive: true, publishAt: { lte: new Date() } }),
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        society: { select: { id: true, name: true } },
      },
    });

    if (!notice) {
      throw new AppError('Notice not found', 404);
    }

    // Increment view count
    await prisma.notice.update({
      where: { id: noticeId },
      data: { viewCount: { increment: 1 } },
    });

    return formatNotice(notice);
  }

  async updateNotice(noticeId: string, data: UpdateNoticeInput, userId: string, societyId: string) {
    const notice = await findInSociety(prisma.notice, noticeId, societyId, { entity: 'Notice' });

    if (notice.createdById !== userId) {
      throw new AppError('You can only edit your own notices', 403);
    }

    const updatedNotice = await prisma.notice.update({
      where: { id: noticeId },
      data: {
        type: data.type,
        priority: data.priority,
        title: data.title,
        description: data.description,
        images: data.images,
        documents: data.documents,
        isUrgent: data.isUrgent,
        isPinned: data.isPinned,
        publishAt: data.publishAt,
        expiresAt: data.expiresAt,
        isActive: data.isActive,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return updatedNotice;
  }

  async deleteNotice(noticeId: string, userId: string, societyId: string) {
    const notice = await findInSociety(prisma.notice, noticeId, societyId, { entity: 'Notice' });

    if (notice.createdById !== userId) {
      throw new AppError('You can only delete your own notices', 403);
    }

    await prisma.notice.delete({
      where: { id: noticeId },
    });

    return { message: 'Notice deleted successfully' };
  }

  async togglePinNotice(noticeId: string, societyId: string) {
    const notice = await findInSociety(prisma.notice, noticeId, societyId, { entity: 'Notice' });

    const updatedNotice = await prisma.notice.update({
      where: { id: noticeId },
      data: { isPinned: !notice.isPinned },
    });

    return updatedNotice;
  }
}
