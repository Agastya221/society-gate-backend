"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
class VendorService {
    async createVendor(data, addedById) {
        const vendor = await Client_1.prisma.vendor.create({
            data: {
                ...data,
                addedById,
            },
            include: {
                addedBy: { select: { id: true, name: true, role: true } },
                society: { select: { id: true, name: true } },
            },
        });
        return vendor;
    }
    async getVendors(filters) {
        const { societyId, category, isVerified, isActive = true, page = 1, limit = 20 } = filters;
        const where = { societyId };
        if (category)
            where.category = category;
        if (isVerified !== undefined)
            where.isVerified = isVerified === 'true';
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [vendors, total] = await Promise.all([
            Client_1.prisma.vendor.findMany({
                where,
                orderBy: [
                    { isVerified: 'desc' },
                    { rating: 'desc' },
                    { name: 'asc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            Client_1.prisma.vendor.count({ where }),
        ]);
        return {
            vendors,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getVendorById(vendorId) {
        const vendor = await Client_1.prisma.vendor.findUnique({
            where: { id: vendorId },
            include: {
                addedBy: { select: { id: true, name: true, role: true } },
            },
        });
        if (!vendor) {
            throw new ResponseHandler_1.AppError('Vendor not found', 404);
        }
        return vendor;
    }
    async updateVendor(vendorId, data) {
        const vendor = await Client_1.prisma.vendor.findUnique({
            where: { id: vendorId },
        });
        if (!vendor) {
            throw new ResponseHandler_1.AppError('Vendor not found', 404);
        }
        const updatedVendor = await Client_1.prisma.vendor.update({
            where: { id: vendorId },
            data,
        });
        return updatedVendor;
    }
    async verifyVendor(vendorId) {
        const vendor = await Client_1.prisma.vendor.findUnique({
            where: { id: vendorId },
        });
        if (!vendor) {
            throw new ResponseHandler_1.AppError('Vendor not found', 404);
        }
        const updatedVendor = await Client_1.prisma.vendor.update({
            where: { id: vendorId },
            data: {
                isVerified: !vendor.isVerified,
                verifiedAt: !vendor.isVerified ? new Date() : null,
            },
        });
        return updatedVendor;
    }
    async deleteVendor(vendorId) {
        const vendor = await Client_1.prisma.vendor.findUnique({
            where: { id: vendorId },
        });
        if (!vendor) {
            throw new ResponseHandler_1.AppError('Vendor not found', 404);
        }
        await Client_1.prisma.vendor.delete({
            where: { id: vendorId },
        });
        return { message: 'Vendor deleted successfully' };
    }
    async updateVendorRating(vendorId, rating) {
        const vendor = await Client_1.prisma.vendor.findUnique({
            where: { id: vendorId },
        });
        if (!vendor) {
            throw new ResponseHandler_1.AppError('Vendor not found', 404);
        }
        // Calculate new average rating
        const totalReviews = vendor.totalReviews + 1;
        const currentTotal = (vendor.rating || 0) * vendor.totalReviews;
        const newRating = (currentTotal + rating) / totalReviews;
        const updatedVendor = await Client_1.prisma.vendor.update({
            where: { id: vendorId },
            data: {
                rating: newRating,
                totalReviews,
            },
        });
        return updatedVendor;
    }
    async getVendorsByCategory(societyId) {
        const vendors = await Client_1.prisma.vendor.findMany({
            where: {
                societyId,
                isActive: true,
            },
            orderBy: [
                { category: 'asc' },
                { isVerified: 'desc' },
                { rating: 'desc' },
            ],
        });
        // Group by category
        const groupedByCategory = vendors.reduce((acc, vendor) => {
            if (!acc[vendor.category]) {
                acc[vendor.category] = [];
            }
            acc[vendor.category].push(vendor);
            return acc;
        }, {});
        return groupedByCategory;
    }
}
exports.VendorService = VendorService;
