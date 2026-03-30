import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type {
  CreateVendorDTO,
  UpdateVendorDTO,
  VendorFilters,
  Prisma,
  VendorCategory,
} from '../../types';

// Compute initials from a name (e.g. "John Doe" → "JD")
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

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

    return this._formatVendor(vendor, null);
  }

  async getVendors(filters: VendorFilters & { requestingUserId?: string }) {
    const { societyId, category, isVerified, isActive, requestingUserId, page = 1, limit = 20 } = filters;

    const where: Prisma.VendorWhereInput = { societyId };
    if (category) where.category = category;
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (isActive !== undefined) where.isActive = isActive;

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          addedBy: { select: { id: true, name: true, role: true } },
          likes: requestingUserId
            ? { where: { userId: requestingUserId }, select: { id: true } }
            : false,
        },
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
      vendors: vendors.map((v) =>
        this._formatVendor(v, requestingUserId ?? null)
      ),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getVendorById(vendorId: string, requestingUserId?: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        addedBy: { select: { id: true, name: true, role: true } },
        likes: requestingUserId
          ? { where: { userId: requestingUserId }, select: { id: true } }
          : false,
      },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    return this._formatVendor(vendor, requestingUserId ?? null);
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

  // Toggle like — returns { liked: boolean, likesCount: number }
  async toggleLike(vendorId: string, userId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new AppError('Vendor not found', 404);

    const existing = await prisma.vendorLike.findUnique({
      where: { vendorId_userId: { vendorId, userId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.vendorLike.delete({ where: { id: existing.id } }),
        prisma.vendor.update({
          where: { id: vendorId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false, likesCount: Math.max(0, vendor.likesCount - 1) };
    } else {
      await prisma.$transaction([
        prisma.vendorLike.create({ data: { vendorId, userId } }),
        prisma.vendor.update({
          where: { id: vendorId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      return { liked: true, likesCount: vendor.likesCount + 1 };
    }
  }

  // Returns category list with count of vendors per category
  async getCategorySummary(societyId: string) {
    const counts = await prisma.vendor.groupBy({
      by: ['category'],
      where: { societyId, isActive: true },
      _count: { id: true },
      orderBy: { category: 'asc' },
    });

    return counts.map((c) => ({
      category: c.category,
      count: c._count.id,
    }));
  }

  async getVendorsByCategory(societyId: string) {
    const vendors = await prisma.vendor.findMany({
      where: {
        societyId,
        isActive: true,
      },
      include: {
        addedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: [
        { category: 'asc' },
        { isVerified: 'desc' },
        { rating: 'desc' },
      ],
    });

    // Group by category
    const grouped = vendors.reduce<Record<string, ReturnType<typeof this._formatVendor>[]>>(
      (acc, vendor) => {
        if (!acc[vendor.category]) acc[vendor.category] = [];
        acc[vendor.category].push(this._formatVendor(vendor, null));
        return acc;
      },
      {}
    );

    return grouped;
  }

  // Shapes vendor for frontend: adds initials + isLikedByMe, hides raw likes array
  private _formatVendor(
    vendor: {
      addedBy?: { id: string; name: string; role: string } | null;
      likesCount: number;
      likes?: { id: string }[];
      [key: string]: unknown;
    },
    requestingUserId: string | null
  ) {
    const { addedBy, likes, ...rest } = vendor;
    return {
      ...rest,
      addedBy: addedBy
        ? { ...addedBy, initials: getInitials(addedBy.name) }
        : null,
      isLikedByMe: requestingUserId ? (likes?.length ?? 0) > 0 : undefined,
    };
  }
}
