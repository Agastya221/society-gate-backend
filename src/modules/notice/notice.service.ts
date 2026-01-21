import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';

export class NoticeService {
  async createNotice(data: any, createdById: string) {
    const notice = await prisma.notice.create({
      data: {
        ...data,
        createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        society: { select: { id: true, name: true } },
      },
    });

    return notice;
  }

  async getNotices(filters: any) {
    const { societyId, type, priority, isPinned, isActive = true, page = 1, limit = 20 } = filters;

    const where: any = { societyId };
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (isPinned !== undefined) where.isPinned = isPinned === 'true';
    if (isActive !== undefined) where.isActive = isActive === 'true';

    // Only show published notices
    where.publishAt = { lte: new Date() };

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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notice.count({ where }),
    ]);

    return {
      notices,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getNoticeById(noticeId: string) {
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
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

    return notice;
  }

  async updateNotice(noticeId: string, data: any, userId: string) {
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new AppError('Notice not found', 404);
    }

    if (notice.createdById !== userId) {
      throw new AppError('You can only edit your own notices', 403);
    }

    const updatedNotice = await prisma.notice.update({
      where: { id: noticeId },
      data,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return updatedNotice;
  }

  async deleteNotice(noticeId: string, userId: string) {
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new AppError('Notice not found', 404);
    }

    if (notice.createdById !== userId) {
      throw new AppError('You can only delete your own notices', 403);
    }

    await prisma.notice.delete({
      where: { id: noticeId },
    });

    return { message: 'Notice deleted successfully' };
  }

  async togglePinNotice(noticeId: string) {
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new AppError('Notice not found', 404);
    }

    const updatedNotice = await prisma.notice.update({
      where: { id: noticeId },
      data: { isPinned: !notice.isPinned },
    });

    return updatedNotice;
  }
}
