"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoticeService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
class NoticeService {
    async createNotice(data, createdById) {
        const notice = await Client_1.prisma.notice.create({
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
    async getNotices(filters) {
        const { societyId, type, priority, isPinned, isActive = true, page = 1, limit = 20 } = filters;
        const where = { societyId };
        if (type)
            where.type = type;
        if (priority)
            where.priority = priority;
        if (isPinned !== undefined)
            where.isPinned = isPinned === 'true';
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        // Only show published notices
        where.publishAt = { lte: new Date() };
        const [notices, total] = await Promise.all([
            Client_1.prisma.notice.findMany({
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
            Client_1.prisma.notice.count({ where }),
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
    async getNoticeById(noticeId) {
        const notice = await Client_1.prisma.notice.findUnique({
            where: { id: noticeId },
            include: {
                createdBy: { select: { id: true, name: true, role: true } },
                society: { select: { id: true, name: true } },
            },
        });
        if (!notice) {
            throw new ResponseHandler_1.AppError('Notice not found', 404);
        }
        // Increment view count
        await Client_1.prisma.notice.update({
            where: { id: noticeId },
            data: { viewCount: { increment: 1 } },
        });
        return notice;
    }
    async updateNotice(noticeId, data, userId) {
        const notice = await Client_1.prisma.notice.findUnique({
            where: { id: noticeId },
        });
        if (!notice) {
            throw new ResponseHandler_1.AppError('Notice not found', 404);
        }
        if (notice.createdById !== userId) {
            throw new ResponseHandler_1.AppError('You can only edit your own notices', 403);
        }
        const updatedNotice = await Client_1.prisma.notice.update({
            where: { id: noticeId },
            data,
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });
        return updatedNotice;
    }
    async deleteNotice(noticeId, userId) {
        const notice = await Client_1.prisma.notice.findUnique({
            where: { id: noticeId },
        });
        if (!notice) {
            throw new ResponseHandler_1.AppError('Notice not found', 404);
        }
        if (notice.createdById !== userId) {
            throw new ResponseHandler_1.AppError('You can only delete your own notices', 403);
        }
        await Client_1.prisma.notice.delete({
            where: { id: noticeId },
        });
        return { message: 'Notice deleted successfully' };
    }
    async togglePinNotice(noticeId) {
        const notice = await Client_1.prisma.notice.findUnique({
            where: { id: noticeId },
        });
        if (!notice) {
            throw new ResponseHandler_1.AppError('Notice not found', 404);
        }
        const updatedNotice = await Client_1.prisma.notice.update({
            where: { id: noticeId },
            data: { isPinned: !notice.isPinned },
        });
        return updatedNotice;
    }
}
exports.NoticeService = NoticeService;
