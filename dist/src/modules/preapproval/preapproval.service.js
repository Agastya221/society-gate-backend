"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreApprovalService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const QrGenerate_1 = require("../../utils/QrGenerate");
class PreApprovalService {
    // ============================================
    // CREATE PRE-APPROVAL WITH QR CODE
    // ============================================
    async createPreApproval(data, userId) {
        const user = await Client_1.prisma.user.findUnique({
            where: { id: userId },
            include: { flat: true, society: true },
        });
        if (!user || user.role !== 'RESIDENT') {
            throw new ResponseHandler_1.AppError('Only residents can create pre-approvals', 403);
        }
        if (!user.flatId) {
            throw new ResponseHandler_1.AppError('User must have a flat assigned', 400);
        }
        // Validate dates
        const validFrom = new Date(data.validFrom);
        const validUntil = new Date(data.validUntil);
        if (validFrom >= validUntil) {
            throw new ResponseHandler_1.AppError('Valid until date must be after valid from date', 400);
        }
        if (validUntil < new Date()) {
            throw new ResponseHandler_1.AppError('Valid until date must be in the future', 400);
        }
        // Generate unique QR token
        const qrTokenPayload = {
            type: 'PRE_APPROVAL',
            visitorPhone: data.visitorPhone,
            visitorName: data.visitorName,
            flatId: user.flatId,
            societyId: user.societyId,
            createdAt: new Date().toISOString(),
        };
        const qrToken = (0, QrGenerate_1.generateQRToken)(qrTokenPayload, '90d'); // 90 days max
        // Generate QR code image
        const qrCodeImage = await (0, QrGenerate_1.generateQRImage)(qrToken);
        // Create pre-approval
        const preApproval = await Client_1.prisma.preApproval.create({
            data: {
                visitorName: data.visitorName,
                visitorPhone: data.visitorPhone,
                visitorType: data.visitorType,
                purpose: data.purpose,
                vehicleNumber: data.vehicleNumber,
                qrToken,
                validFrom,
                validUntil,
                maxUses: data.maxUses || 1,
                usedCount: 0,
                status: 'ACTIVE',
                flatId: user.flatId,
                societyId: user.societyId,
                createdById: userId,
            },
            include: {
                flat: {
                    select: {
                        flatNumber: true,
                        block: true,
                        floor: true,
                    },
                },
                society: {
                    select: {
                        name: true,
                        address: true,
                    },
                },
            },
        });
        return {
            preApproval,
            qrCodeImage,
            qrToken,
        };
    }
    // ============================================
    // GET PRE-APPROVALS (Resident)
    // ============================================
    async getPreApprovals(userId, filters) {
        const user = await Client_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user || !user.flatId) {
            throw new ResponseHandler_1.AppError('User must have a flat assigned', 400);
        }
        const where = {
            flatId: user.flatId,
        };
        if (filters?.status) {
            where.status = filters.status;
        }
        const preApprovals = await Client_1.prisma.preApproval.findMany({
            where,
            include: {
                flat: {
                    select: {
                        flatNumber: true,
                    },
                },
                entries: {
                    select: {
                        id: true,
                        checkInTime: true,
                        checkOutTime: true,
                    },
                    orderBy: {
                        checkInTime: 'desc',
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return preApprovals;
    }
    // ============================================
    // GET PRE-APPROVAL QR CODE
    // ============================================
    async getPreApprovalQR(preApprovalId, userId) {
        const preApproval = await Client_1.prisma.preApproval.findUnique({
            where: { id: preApprovalId },
            include: {
                flat: true,
            },
        });
        if (!preApproval) {
            throw new ResponseHandler_1.AppError('Pre-approval not found', 404);
        }
        // Verify user owns this pre-approval
        const user = await Client_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user || user.flatId !== preApproval.flatId) {
            throw new ResponseHandler_1.AppError('You can only access QR codes for your own pre-approvals', 403);
        }
        // Regenerate QR image from token
        const qrCodeImage = await (0, QrGenerate_1.generateQRImage)(preApproval.qrToken);
        return {
            preApproval,
            qrCodeImage,
            qrToken: preApproval.qrToken,
        };
    }
    // ============================================
    // CANCEL PRE-APPROVAL
    // ============================================
    async cancelPreApproval(preApprovalId, userId) {
        const preApproval = await Client_1.prisma.preApproval.findUnique({
            where: { id: preApprovalId },
        });
        if (!preApproval) {
            throw new ResponseHandler_1.AppError('Pre-approval not found', 404);
        }
        if (preApproval.createdById !== userId) {
            throw new ResponseHandler_1.AppError('You can only cancel your own pre-approvals', 403);
        }
        if (preApproval.status === 'CANCELLED') {
            throw new ResponseHandler_1.AppError('Pre-approval already cancelled', 400);
        }
        const updated = await Client_1.prisma.preApproval.update({
            where: { id: preApprovalId },
            data: { status: 'CANCELLED' },
        });
        return updated;
    }
    // ============================================
    // SCAN PRE-APPROVAL QR CODE (Guard)
    // ============================================
    async scanPreApprovalQR(qrToken, guardId) {
        const guard = await Client_1.prisma.user.findUnique({
            where: { id: guardId },
        });
        if (!guard || guard.role !== 'GUARD') {
            throw new ResponseHandler_1.AppError('Only guards can scan QR codes', 403);
        }
        // Verify QR token
        let decoded;
        try {
            decoded = (0, QrGenerate_1.verifyQRToken)(qrToken);
        }
        catch (error) {
            throw new ResponseHandler_1.AppError(error.message, 400);
        }
        if (typeof decoded !== 'object' || decoded.type !== 'PRE_APPROVAL') {
            throw new ResponseHandler_1.AppError('This is not a pre-approval QR code', 400);
        }
        // Find pre-approval
        const preApproval = await Client_1.prisma.preApproval.findUnique({
            where: { qrToken },
            include: {
                flat: true,
                createdBy: {
                    select: {
                        name: true,
                        phone: true,
                    },
                },
            },
        });
        if (!preApproval) {
            throw new ResponseHandler_1.AppError('Pre-approval not found', 404);
        }
        // Validate society match
        if (preApproval.societyId !== guard.societyId) {
            throw new ResponseHandler_1.AppError('This pre-approval belongs to a different society', 403);
        }
        // Check status
        if (preApproval.status === 'CANCELLED') {
            throw new ResponseHandler_1.AppError('Pre-approval has been cancelled by resident', 400);
        }
        if (preApproval.status === 'USED') {
            throw new ResponseHandler_1.AppError('Pre-approval has been fully used', 400);
        }
        if (preApproval.status === 'EXPIRED') {
            throw new ResponseHandler_1.AppError('Pre-approval has expired', 400);
        }
        // Check validity period
        const now = new Date();
        if (now < preApproval.validFrom) {
            throw new ResponseHandler_1.AppError(`Pre-approval is not yet valid. Valid from: ${preApproval.validFrom.toLocaleString()}`, 400);
        }
        if (now > preApproval.validUntil) {
            await Client_1.prisma.preApproval.update({
                where: { id: preApproval.id },
                data: { status: 'EXPIRED' },
            });
            throw new ResponseHandler_1.AppError('Pre-approval has expired', 400);
        }
        // Check max uses
        if (preApproval.usedCount >= preApproval.maxUses) {
            await Client_1.prisma.preApproval.update({
                where: { id: preApproval.id },
                data: { status: 'USED' },
            });
            throw new ResponseHandler_1.AppError('Pre-approval has reached maximum uses', 400);
        }
        // Create entry with pre-approval
        const entry = await Client_1.prisma.entry.create({
            data: {
                type: 'VISITOR',
                status: 'APPROVED',
                visitorName: preApproval.visitorName,
                visitorPhone: preApproval.visitorPhone,
                visitorType: preApproval.visitorType,
                purpose: preApproval.purpose,
                vehicleNumber: preApproval.vehicleNumber,
                flatId: preApproval.flatId,
                societyId: preApproval.societyId,
                preApprovalId: preApproval.id,
                createdById: guardId,
                wasAutoApproved: true,
                autoApprovalReason: 'Pre-approved by resident',
                approvedAt: new Date(),
                checkInTime: new Date(),
            },
            include: {
                flat: true,
            },
        });
        // Update pre-approval usage
        const updatedUsedCount = preApproval.usedCount + 1;
        const newStatus = updatedUsedCount >= preApproval.maxUses ? 'USED' : 'ACTIVE';
        await Client_1.prisma.preApproval.update({
            where: { id: preApproval.id },
            data: {
                usedCount: updatedUsedCount,
                status: newStatus,
            },
        });
        return {
            entry,
            preApproval: {
                visitorName: preApproval.visitorName,
                flatNumber: preApproval.flat.flatNumber,
                usedCount: updatedUsedCount,
                maxUses: preApproval.maxUses,
                remainingUses: preApproval.maxUses - updatedUsedCount,
                createdBy: preApproval.createdBy.name,
            },
        };
    }
}
exports.PreApprovalService = PreApprovalService;
