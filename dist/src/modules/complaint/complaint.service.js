"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplaintService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
class ComplaintService {
    async createComplaint(data, reportedById) {
        const complaint = await Client_1.prisma.complaint.create({
            data: {
                ...data,
                reportedById,
            },
            include: {
                reportedBy: { select: { id: true, name: true, phone: true } },
                flat: true,
                society: { select: { id: true, name: true } },
            },
        });
        return complaint;
    }
    async getComplaints(filters) {
        const { societyId, flatId, category, status, priority, page = 1, limit = 20 } = filters;
        const where = { societyId };
        if (flatId)
            where.flatId = flatId;
        if (category)
            where.category = category;
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        const [complaints, total] = await Promise.all([
            Client_1.prisma.complaint.findMany({
                where,
                include: {
                    reportedBy: { select: { id: true, name: true, phone: true } },
                    flat: true,
                    assignedTo: { select: { id: true, name: true, phone: true } },
                    resolvedBy: { select: { id: true, name: true, phone: true } },
                },
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'desc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            Client_1.prisma.complaint.count({ where }),
        ]);
        return {
            complaints,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getComplaintById(complaintId) {
        const complaint = await Client_1.prisma.complaint.findUnique({
            where: { id: complaintId },
            include: {
                reportedBy: { select: { id: true, name: true, phone: true } },
                flat: true,
                assignedTo: { select: { id: true, name: true, phone: true } },
                resolvedBy: { select: { id: true, name: true, phone: true } },
            },
        });
        if (!complaint) {
            throw new ResponseHandler_1.AppError('Complaint not found', 404);
        }
        return complaint;
    }
    async updateComplaintStatus(complaintId, status) {
        const complaint = await Client_1.prisma.complaint.findUnique({
            where: { id: complaintId },
        });
        if (!complaint) {
            throw new ResponseHandler_1.AppError('Complaint not found', 404);
        }
        const updatedComplaint = await Client_1.prisma.complaint.update({
            where: { id: complaintId },
            data: { status: status },
        });
        return updatedComplaint;
    }
    async assignComplaint(complaintId, assignedToId) {
        const complaint = await Client_1.prisma.complaint.findUnique({
            where: { id: complaintId },
        });
        if (!complaint) {
            throw new ResponseHandler_1.AppError('Complaint not found', 404);
        }
        const updatedComplaint = await Client_1.prisma.complaint.update({
            where: { id: complaintId },
            data: {
                assignedToId,
                assignedAt: new Date(),
                status: 'IN_PROGRESS',
            },
            include: {
                assignedTo: { select: { id: true, name: true, phone: true } },
            },
        });
        return updatedComplaint;
    }
    async resolveComplaint(complaintId, resolution, resolvedById) {
        const complaint = await Client_1.prisma.complaint.findUnique({
            where: { id: complaintId },
        });
        if (!complaint) {
            throw new ResponseHandler_1.AppError('Complaint not found', 404);
        }
        const updatedComplaint = await Client_1.prisma.complaint.update({
            where: { id: complaintId },
            data: {
                status: 'RESOLVED',
                resolution,
                resolvedById,
                resolvedAt: new Date(),
            },
            include: {
                resolvedBy: { select: { id: true, name: true, phone: true } },
            },
        });
        return updatedComplaint;
    }
    async deleteComplaint(complaintId, userId) {
        const complaint = await Client_1.prisma.complaint.findUnique({
            where: { id: complaintId },
        });
        if (!complaint) {
            throw new ResponseHandler_1.AppError('Complaint not found', 404);
        }
        if (complaint.reportedById !== userId) {
            throw new ResponseHandler_1.AppError('You can only delete your own complaints', 403);
        }
        await Client_1.prisma.complaint.delete({
            where: { id: complaintId },
        });
        return { message: 'Complaint deleted successfully' };
    }
}
exports.ComplaintService = ComplaintService;
