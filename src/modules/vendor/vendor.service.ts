import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type {
  CreateVendorDTO,
  UpdateVendorDTO,
  VendorFilters,
  Prisma,
  VendorCategory,
  Vendor,
} from '../../types';

export class VendorService {
  async createVendor(data: CreateVendorDTO, addedById: string) {
    const vendor = await prisma.vendor.create({
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

  async getVendors(filters: VendorFilters) {
    const { societyId, category, isVerified, isActive, page = 1, limit = 20 } = filters;

    const where: Prisma.VendorWhereInput = { societyId };
    if (category) where.category = category;
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (isActive !== undefined) where.isActive = isActive;

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        orderBy: [
          { isVerified: 'desc' },
          { rating: 'desc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vendor.count({ where }),
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

  async getVendorById(vendorId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        addedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    return vendor;
  }

  async updateVendor(vendorId: string, data: UpdateVendorDTO) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data,
    });

    return updatedVendor;
  }

  async verifyVendor(vendorId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        isVerified: !vendor.isVerified,
        verifiedAt: !vendor.isVerified ? new Date() : null,
      },
    });

    return updatedVendor;
  }

  async deleteVendor(vendorId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    await prisma.vendor.delete({
      where: { id: vendorId },
    });

    return { message: 'Vendor deleted successfully' };
  }

  async updateVendorRating(vendorId: string, rating: number) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    // Calculate new average rating
    const totalReviews = vendor.totalReviews + 1;
    const currentTotal = (vendor.rating || 0) * vendor.totalReviews;
    const newRating = (currentTotal + rating) / totalReviews;

    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        rating: newRating,
        totalReviews,
      },
    });

    return updatedVendor;
  }

  async getVendorsByCategory(societyId: string) {
    const vendors = await prisma.vendor.findMany({
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
    const groupedByCategory = vendors.reduce<Record<VendorCategory, Vendor[]>>((acc, vendor) => {
      if (!acc[vendor.category]) {
        acc[vendor.category] = [];
      }
      acc[vendor.category].push(vendor);
      return acc;
    }, {} as Record<VendorCategory, Vendor[]>);

    return groupedByCategory;
  }
}
