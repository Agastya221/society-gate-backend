"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatePassService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const QrGenerate_1 = require("../../utils/QrGenerate");
class GatePassService {
    async createGatePass(data, requestedById) {
        // Get user info to determine flatId and societyId
        const user = await Client_1.prisma.user.findUnique({
            where: { id: requestedById },
            include: { flat: true, society: true },
        });
        if (!user) {
            throw new ResponseHandler_1.AppError('User not found', 404);
        }
        if (!user.flatId || !user.societyId) {
            throw new ResponseHandler_1.AppError('User must have a flat and society assigned', 400);
        }
        const flatId = data.flatId || user.flatId;
        const societyId = data.societyId || user.societyId;
        // Verify flat belongs to society
        const flat = await Client_1.prisma.flat.findUnique({
            where: { id: flatId },
            include: { society: true },
        });
        if (!flat || flat.societyId !== societyId) {
            throw new ResponseHandler_1.AppError('Invalid flat or society', 400);
        }
        // Generate QR token
        const qrToken = await (0, QrGenerate_1.generateQRToken)({
            type: 'gatepass',
            flatId,
            societyId,
            passType: data.type,
        });
        const gatePass = await Client_1.prisma.gatePass.create({
            data: {
                ...data,
                flatId,
                societyId,
                requestedById,
                qrToken,
                status: 'PENDING',
            },
            include: {
                flat: true,
                requestedBy: { select: { id: true, name: true, phone: true, role: true } },
                society: { select: { id: true, name: true } },
            },
        });
        return gatePass;
    }
    async approveGatePass(gatePassId, approvedById) {
        const gatePass = await Client_1.prisma.gatePass.findUnique({
            where: { id: gatePassId },
        });
        if (!gatePass) {
            throw new ResponseHandler_1.AppError('Gate pass not found', 404);
        }
        if (gatePass.status !== 'PENDING') {
            throw new ResponseHandler_1.AppError('Gate pass is not pending approval', 400);
        }
        const updatedGatePass = await Client_1.prisma.gatePass.update({
            where: { id: gatePassId },
            data: {
                status: 'APPROVED',
                approvedById,
                approvedAt: new Date(),
            },
            include: {
                flat: true,
                requestedBy: { select: { id: true, name: true, phone: true } },
                approvedBy: { select: { id: true, name: true, phone: true } },
            },
        });
        return updatedGatePass;
    }
    async rejectGatePass(gatePassId, reason, approvedById) {
        const gatePass = await Client_1.prisma.gatePass.findUnique({
            where: { id: gatePassId },
        });
        if (!gatePass) {
            throw new ResponseHandler_1.AppError('Gate pass not found', 404);
        }
        if (gatePass.status !== 'PENDING') {
            throw new ResponseHandler_1.AppError('Gate pass is not pending approval', 400);
        }
        const updatedGatePass = await Client_1.prisma.gatePass.update({
            where: { id: gatePassId },
            data: {
                status: 'REJECTED',
                approvedById,
                rejectionReason: reason,
            },
            include: {
                flat: true,
                requestedBy: { select: { id: true, name: true, phone: true } },
                approvedBy: { select: { id: true, name: true, phone: true } },
            },
        });
        return updatedGatePass;
    }
    async scanGatePass(qrToken, guardId) {
        const gatePass = await Client_1.prisma.gatePass.findUnique({
            where: { qrToken },
            include: {
                flat: true,
                requestedBy: { select: { id: true, name: true, phone: true } },
            },
        });
        if (!gatePass) {
            throw new ResponseHandler_1.AppError('Invalid QR code', 404);
        }
        if (gatePass.status !== 'APPROVED') {
            throw new ResponseHandler_1.AppError('Gate pass is not approved', 400);
        }
        // Check validity
        const now = new Date();
        if (now < gatePass.validFrom || now > gatePass.validUntil) {
            throw new ResponseHandler_1.AppError('Gate pass has expired or not yet valid', 400);
        }
        if (gatePass.isUsed) {
            throw new ResponseHandler_1.AppError('Gate pass already used', 400);
        }
        // Mark as used
        const updatedGatePass = await Client_1.prisma.gatePass.update({
            where: { id: gatePass.id },
            data: {
                isUsed: true,
                usedAt: new Date(),
                usedByGuardId: guardId,
                status: 'USED',
            },
            include: {
                flat: true,
                requestedBy: { select: { id: true, name: true, phone: true } },
            },
        });
        return updatedGatePass;
    }
    async getGatePasses(filters) {
        const { societyId, flatId, status, type, page = 1, limit = 20 } = filters;
        const where = { societyId };
        if (flatId)
            where.flatId = flatId;
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        const [gatePasses, total] = await Promise.all([
            Client_1.prisma.gatePass.findMany({
                where,
                include: {
                    flat: true,
                    requestedBy: { select: { id: true, name: true, phone: true } },
                    approvedBy: { select: { id: true, name: true, phone: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            Client_1.prisma.gatePass.count({ where }),
        ]);
        return {
            gatePasses,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getGatePassById(gatePassId) {
        const gatePass = await Client_1.prisma.gatePass.findUnique({
            where: { id: gatePassId },
            include: {
                flat: true,
                requestedBy: { select: { id: true, name: true, phone: true } },
                approvedBy: { select: { id: true, name: true, phone: true } },
            },
        });
        if (!gatePass) {
            throw new ResponseHandler_1.AppError('Gate pass not found', 404);
        }
        return gatePass;
    }
    async getGatePassQR(gatePassId) {
        const gatePass = await Client_1.prisma.gatePass.findUnique({
            where: { id: gatePassId },
        });
        if (!gatePass) {
            throw new ResponseHandler_1.AppError('Gate pass not found', 404);
        }
        return {
            qrToken: gatePass.qrToken,
            gatePassId: gatePass.id,
            type: gatePass.type,
            validFrom: gatePass.validFrom,
            validUntil: gatePass.validUntil,
            status: gatePass.status,
        };
    }
    async cancelGatePass(gatePassId, userId) {
        const gatePass = await Client_1.prisma.gatePass.findUnique({
            where: { id: gatePassId },
        });
        if (!gatePass) {
            throw new ResponseHandler_1.AppError('Gate pass not found', 404);
        }
        if (gatePass.requestedById !== userId) {
            throw new ResponseHandler_1.AppError('You can only cancel your own gate passes', 403);
        }
        if (gatePass.isUsed) {
            throw new ResponseHandler_1.AppError('Cannot cancel a used gate pass', 400);
        }
        const updatedGatePass = await Client_1.prisma.gatePass.update({
            where: { id: gatePassId },
            data: {
                status: 'EXPIRED',
            },
        });
        return updatedGatePass;
    }
}
exports.GatePassService = GatePassService;
