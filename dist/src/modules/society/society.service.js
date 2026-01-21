"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocietyService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
class SocietyService {
    async createSociety(data) {
        // Set next due date (30 days from now)
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + 30);
        const society = await Client_1.prisma.society.create({
            data: {
                ...data,
                nextDueDate,
                isActive: true,
            },
        });
        // Create default main gate
        await Client_1.prisma.gatePoint.create({
            data: {
                name: 'Main Gate',
                societyId: society.id,
            },
        });
        return society;
    }
    async getSocieties(filters) {
        const { city, isActive, page = 1, limit = 20 } = filters || {};
        const where = {};
        if (city)
            where.city = city;
        if (isActive !== undefined)
            where.isActive = isActive;
        const [societies, total] = await Promise.all([
            Client_1.prisma.society.findMany({
                where,
                include: {
                    _count: {
                        select: {
                            users: true,
                            flats: true,
                            entries: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            Client_1.prisma.society.count({ where }),
        ]);
        return {
            societies,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getSocietyById(societyId) {
        const society = await Client_1.prisma.society.findUnique({
            where: { id: societyId },
            include: {
                gatePoints: true,
                _count: {
                    select: {
                        users: true,
                        flats: true,
                        entries: true,
                    },
                },
            },
        });
        if (!society) {
            throw new ResponseHandler_1.AppError('Society not found', 404);
        }
        return society;
    }
    async updateSociety(societyId, data) {
        const society = await Client_1.prisma.society.update({
            where: { id: societyId },
            data,
        });
        return society;
    }
    async markPaymentPaid(societyId) {
        const today = new Date();
        const nextDueDate = new Date(today);
        nextDueDate.setDate(nextDueDate.getDate() + 30);
        const society = await Client_1.prisma.society.update({
            where: { id: societyId },
            data: {
                lastPaidDate: today,
                nextDueDate,
                paymentStatus: 'PAID',
                isActive: true,
            },
        });
        // Create payment reminder record
        await Client_1.prisma.paymentReminder.create({
            data: {
                societyId,
                dueDate: nextDueDate,
                amount: society.monthlyFee,
                isPaid: true,
                paidAt: today,
            },
        });
        return society;
    }
    async getSocietyStats(societyId) {
        const [totalFlats, totalResidents, totalGuards, totalDomesticStaff, todayEntries, pendingEntries,] = await Promise.all([
            Client_1.prisma.flat.count({ where: { societyId } }),
            Client_1.prisma.user.count({ where: { societyId, role: 'RESIDENT' } }),
            Client_1.prisma.user.count({ where: { societyId, role: 'GUARD' } }),
            Client_1.prisma.domesticStaff.count({ where: { isActive: true } }),
            Client_1.prisma.entry.count({
                where: {
                    societyId,
                    checkInTime: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),
            Client_1.prisma.entry.count({
                where: {
                    societyId,
                    status: 'PENDING',
                },
            }),
        ]);
        return {
            totalFlats,
            totalResidents,
            totalGuards,
            totalDomesticStaff,
            todayEntries,
            pendingEntries,
        };
    }
}
exports.SocietyService = SocietyService;
