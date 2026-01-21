"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
class EntryService {
    async createEntry(data, createdById) {
        const { flatId, societyId, type, companyName } = data;
        // Check if delivery has auto-approval
        if (type === 'DELIVERY' && companyName) {
            const autoApproval = await this.checkAutoApproval(flatId, companyName);
            if (autoApproval) {
                const entry = await Client_1.prisma.entry.create({
                    data: {
                        ...data,
                        createdById,
                        status: 'APPROVED',
                        wasAutoApproved: true,
                        autoApprovalReason: autoApproval.reason,
                        approvedAt: new Date(),
                    },
                    include: {
                        flat: true,
                        createdBy: { select: { id: true, name: true, role: true } },
                    },
                });
                // TODO: Send notification
                await this.updateVisitorFrequency(flatId, data.visitorPhone, data.visitorName);
                return entry;
            }
        }
        // Check for QR pre-approval with transaction to prevent race conditions
        if (data.preApprovalId) {
            const entry = await Client_1.prisma.$transaction(async (tx) => {
                const preApproval = await tx.preApproval.findUnique({
                    where: { id: data.preApprovalId },
                });
                if (!preApproval || preApproval.status !== 'ACTIVE') {
                    throw new ResponseHandler_1.AppError('Pre-approval not found or not active', 404);
                }
                // Check if max uses would be exceeded
                if (preApproval.usedCount + 1 > preApproval.maxUses) {
                    throw new ResponseHandler_1.AppError('Pre-approval has reached maximum uses', 400);
                }
                // Create entry and update pre-approval atomically
                const newEntry = await tx.entry.create({
                    data: {
                        ...data,
                        createdById,
                        status: 'APPROVED',
                        approvedAt: new Date(),
                    },
                    include: {
                        flat: true,
                        createdBy: true,
                    },
                });
                // Update pre-approval usage
                const newUsedCount = preApproval.usedCount + 1;
                await tx.preApproval.update({
                    where: { id: data.preApprovalId },
                    data: {
                        usedCount: { increment: 1 },
                        status: newUsedCount >= preApproval.maxUses ? 'USED' : 'ACTIVE',
                    },
                });
                return newEntry;
            });
            return entry;
        }
        // Regular entry - needs approval
        const entry = await Client_1.prisma.entry.create({
            data: {
                ...data,
                createdById,
                status: 'PENDING',
            },
            include: {
                flat: true,
                createdBy: true,
            },
        });
        // Update visitor frequency
        if (data.visitorPhone) {
            await this.updateVisitorFrequency(flatId, data.visitorPhone, data.visitorName);
        }
        // TODO: Send notification to resident
        return entry;
    }
    async checkAutoApproval(flatId, companyName) {
        // Check expected delivery
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const expectedDelivery = await Client_1.prisma.expectedDelivery.findFirst({
            where: {
                flatId,
                companyName,
                isUsed: false,
                expectedDate: {
                    gte: today,
                    lt: tomorrow,
                },
            },
        });
        if (expectedDelivery && expectedDelivery.autoApprove) {
            await Client_1.prisma.expectedDelivery.update({
                where: { id: expectedDelivery.id },
                data: { isUsed: true, usedAt: new Date() },
            });
            return { reason: 'Expected delivery' };
        }
        // Check standing rule
        const now = new Date();
        const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
        const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
        const rule = await Client_1.prisma.deliveryAutoApproveRule.findFirst({
            where: {
                flatId,
                isActive: true,
                companies: { has: companyName },
            },
        });
        if (rule) {
            // Check day restriction
            if (rule.allowedDays.length > 0 && !rule.allowedDays.includes(currentDay)) {
                return null;
            }
            // Check time restriction
            if (rule.timeFrom && rule.timeUntil) {
                if (currentTime < rule.timeFrom || currentTime > rule.timeUntil) {
                    return null;
                }
            }
            return { reason: 'Auto-approve rule' };
        }
        return null;
    }
    async updateVisitorFrequency(flatId, visitorPhone, visitorName) {
        if (!visitorPhone)
            return;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Find or create visitor frequency record
        const existing = await Client_1.prisma.visitorFrequency.findUnique({
            where: {
                societyId_flatId_visitorPhone: {
                    societyId: (await Client_1.prisma.flat.findUnique({ where: { id: flatId } })).societyId,
                    flatId,
                    visitorPhone,
                },
            },
        });
        if (existing) {
            const newVisitCount = existing.visitCount + 1;
            const isFrequent = newVisitCount >= 3;
            await Client_1.prisma.visitorFrequency.update({
                where: { id: existing.id },
                data: {
                    visitCount: newVisitCount,
                    lastVisit: new Date(),
                    isFrequent,
                    visitorName, // Update name in case it changed
                },
            });
        }
        else {
            const flat = await Client_1.prisma.flat.findUnique({ where: { id: flatId } });
            await Client_1.prisma.visitorFrequency.create({
                data: {
                    flatId,
                    societyId: flat.societyId,
                    visitorPhone,
                    visitorName,
                    visitCount: 1,
                    lastVisit: new Date(),
                    isFrequent: false,
                },
            });
        }
    }
    async approveEntry(entryId, approvedById) {
        const entry = await Client_1.prisma.entry.findUnique({
            where: { id: entryId },
            include: { flat: true },
        });
        if (!entry) {
            throw new ResponseHandler_1.AppError('Entry not found', 404);
        }
        if (entry.status !== 'PENDING') {
            throw new ResponseHandler_1.AppError('Entry is not pending approval', 400);
        }
        const updatedEntry = await Client_1.prisma.entry.update({
            where: { id: entryId },
            data: {
                status: 'APPROVED',
                approvedById,
                approvedAt: new Date(),
            },
            include: {
                flat: true,
                createdBy: { select: { id: true, name: true, role: true } },
                approvedBy: { select: { id: true, name: true, role: true } },
            },
        });
        // TODO: Send notification to guard
        return updatedEntry;
    }
    async rejectEntry(entryId, reason, approvedById) {
        const entry = await Client_1.prisma.entry.findUnique({
            where: { id: entryId },
        });
        if (!entry) {
            throw new ResponseHandler_1.AppError('Entry not found', 404);
        }
        if (entry.status !== 'PENDING') {
            throw new ResponseHandler_1.AppError('Entry is not pending approval', 400);
        }
        const updatedEntry = await Client_1.prisma.entry.update({
            where: { id: entryId },
            data: {
                status: 'REJECTED',
                approvedById,
                rejectionReason: reason,
            },
            include: {
                flat: true,
                createdBy: { select: { id: true, name: true, role: true } },
                approvedBy: { select: { id: true, name: true, role: true } },
            },
        });
        // TODO: Send notification to guard
        return updatedEntry;
    }
    async checkoutEntry(entryId) {
        const entry = await Client_1.prisma.entry.findUnique({
            where: { id: entryId },
        });
        if (!entry) {
            throw new ResponseHandler_1.AppError('Entry not found', 404);
        }
        if (entry.status !== 'APPROVED') {
            throw new ResponseHandler_1.AppError('Only approved entries can be checked out', 400);
        }
        if (entry.checkOutTime) {
            throw new ResponseHandler_1.AppError('Entry already checked out', 400);
        }
        const updatedEntry = await Client_1.prisma.entry.update({
            where: { id: entryId },
            data: {
                status: 'CHECKED_OUT',
                checkOutTime: new Date(),
            },
            include: {
                flat: true,
                createdBy: { select: { id: true, name: true, role: true } },
            },
        });
        return updatedEntry;
    }
    async getEntries(filters) {
        const { societyId, flatId, status, type, page = 1, limit = 20 } = filters;
        const where = { societyId };
        if (flatId)
            where.flatId = flatId;
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        const [entries, total] = await Promise.all([
            Client_1.prisma.entry.findMany({
                where,
                include: {
                    flat: true,
                    createdBy: { select: { id: true, name: true, role: true } },
                    approvedBy: { select: { id: true, name: true, role: true } },
                },
                orderBy: { checkInTime: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            Client_1.prisma.entry.count({ where }),
        ]);
        return {
            entries,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getPendingEntries(societyId, flatId) {
        const where = {
            societyId,
            status: 'PENDING',
        };
        if (flatId)
            where.flatId = flatId;
        const entries = await Client_1.prisma.entry.findMany({
            where,
            include: {
                flat: true,
                createdBy: { select: { id: true, name: true, role: true } },
            },
            orderBy: { checkInTime: 'desc' },
        });
        return entries;
    }
    async getTodayEntries(societyId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const entries = await Client_1.prisma.entry.findMany({
            where: {
                societyId,
                checkInTime: {
                    gte: today,
                    lt: tomorrow,
                },
            },
            include: {
                flat: true,
                createdBy: { select: { id: true, name: true, role: true } },
                approvedBy: { select: { id: true, name: true, role: true } },
            },
            orderBy: { checkInTime: 'desc' },
        });
        const stats = {
            total: entries.length,
            pending: entries.filter((e) => e.status === 'PENDING').length,
            approved: entries.filter((e) => e.status === 'APPROVED').length,
            rejected: entries.filter((e) => e.status === 'REJECTED').length,
            checkedOut: entries.filter((e) => e.status === 'CHECKED_OUT').length,
            delivery: entries.filter((e) => e.type === 'DELIVERY').length,
            visitor: entries.filter((e) => e.type === 'VISITOR').length,
            domesticStaff: entries.filter((e) => e.type === 'DOMESTIC_STAFF').length,
        };
        return {
            entries,
            stats,
        };
    }
    async getEntryById(entryId) {
        const entry = await Client_1.prisma.entry.findUnique({
            where: { id: entryId },
            include: {
                flat: true,
                createdBy: { select: { id: true, name: true, role: true } },
                approvedBy: { select: { id: true, name: true, role: true } },
                domesticStaff: true,
            },
        });
        if (!entry) {
            throw new ResponseHandler_1.AppError('Entry not found', 404);
        }
        return entry;
    }
}
exports.EntryService = EntryService;
