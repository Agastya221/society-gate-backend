import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { validateRequiredFields } from '../../utils/validation';
import { ComplaintCategory, ComplaintStatus, ComplaintPriority, Role } from '../../../prisma/generated/prisma/enums';
import { getPresignedViewUrl } from '../../utils/s3';
import type { Prisma } from '../../types';

export class ComplaintService {
  /**
   * Generate presigned view URLs for complaint images
   */
  private async generateImageUrls(images: string[]) {
    if (!images || images.length === 0) return [];

    const results = await Promise.all(
      images.map(async (s3Key) => {
        try {
          if (s3Key.startsWith('file://') || s3Key.startsWith('content://')) {
            console.warn(`Skipping local file path: ${s3Key}`);
            return null;
          }

          let viewUrl = await getPresignedViewUrl(s3Key, 3600);

          // ✅ sanitize bad characters (quotes/spaces) that break signature
          viewUrl = viewUrl.trim().replace(/"+$/, ''); // remove trailing "
          viewUrl = viewUrl.replace(/%22$/, '');       // remove encoded trailing quote if present

          return { s3Key, viewUrl };
        } catch (error) {
          console.error(`Failed to generate URL for ${s3Key}:`, error);
          return null;
        }
      })
    );

    return results.filter(Boolean) as { s3Key: string; viewUrl: string }[];
  }


  // Resident creates complaint with photos
  async createComplaint(
    data: {
      category: ComplaintCategory;
      priority?: ComplaintPriority;
      title: string;
      description: string;
      images?: string[];
      location?: string;
      isAnonymous?: boolean;
    },
    reportedById: string,
    societyId: string,
    flatId: string | null
  ) {
    validateRequiredFields(data, ['category', 'title', 'description'], 'Complaint');

    if (data.images && data.images.length > 5) {
      throw new AppError('Maximum 5 images allowed per complaint', 400);
    }

    const complaint = await prisma.complaint.create({
      data: {
        category: data.category,
        priority: data.priority || 'MEDIUM',
        title: data.title,
        description: data.description,
        images: data.images || [],
        location: data.location,
        isAnonymous: data.isAnonymous || false,
        reportedById,
        flatId,
        societyId,
      },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        flat: {
          select: {
            id: true,
            flatNumber: true,
            block: { select: { name: true } },
          },
        },
        society: { select: { id: true, name: true } },
      },
    });

    return complaint;
  }

  // Get complaints - ALL society members can see ALL society complaints
  async getComplaints(
    filters: {
      category?: ComplaintCategory;
      status?: ComplaintStatus;
      priority?: ComplaintPriority;
      page?: number;
      limit?: number;
      sortBy?: string;
      includeImageUrls?: string;
    },
    userId: string,
    userRole: Role,
    userSocietyId: string,
    userFlatId: string | null
  ) {
    try {
      const {
        category,
        status,
        priority,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        includeImageUrls = 'false'
      } = filters;

      const where: Prisma.ComplaintWhereInput = {};

      // Role-based filtering
      if (userRole === 'SUPER_ADMIN') {
        // SUPER_ADMIN sees all complaints across all societies
      } else if (userRole === 'ADMIN' || userRole === 'RESIDENT') {
        // ADMIN and RESIDENT see all complaints in their society
        if (!userSocietyId) {
          throw new AppError('User must be assigned to a society', 400);
        }
        where.societyId = userSocietyId;
      } else {
        throw new AppError('Invalid role for viewing complaints', 403);
      }

      // Apply additional filters
      if (category) where.category = category;
      if (status) where.status = status;
      if (priority) where.priority = priority;

      // Determine sort order
      const orderBy = sortBy === 'priority'
        ? [{ priority: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

      console.log('Complaints query:', {
        where,
        userRole,
        userSocietyId,
        userId,
        orderBy,
      });

      const [complaints, total] = await Promise.all([
        prisma.complaint.findMany({
          where,
          include: {
            reportedBy: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            flat: {
              select: {
                id: true,
                flatNumber: true,
                block: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            assignedTo: { select: { id: true, name: true, phone: true } },
            resolvedBy: { select: { id: true, name: true, phone: true } },
          },
          orderBy,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.complaint.count({ where }),
      ]);

      // Process complaints with anonymous handling and optional image URLs
      const processedComplaints = await Promise.all(
        complaints.map(async (c) => {
          const isOwn = c.reportedById === userId;

          // Hide reporter details if anonymous (unless it's own complaint or user is ADMIN/SUPER_ADMIN)
          const canSeeReporterDetails = isOwn || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
          const shouldHideReporter = c.isAnonymous && !canSeeReporterDetails;

          const reportedBy = shouldHideReporter ? null : c.reportedBy;
          const flat = shouldHideReporter ? null : c.flat;

          // Optionally include image URLs
          const limitedImages = (c.images || []).slice(0, 5);
          const imageUrls = await this.generateImageUrls(limitedImages);

          // Base complaint data
          return {
            ...c,
            reportedBy,
            flat,
            isOwn,
            imageCount: c.images?.length || 0,
            hasImages: (c.images?.length || 0) > 0,
            imageUrls,
          };
        })
      );

      return {
        complaints: processedComplaints,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      };
    } catch (error) {
      console.error('Error in getComplaints service:', error);
      throw error;
    }
  }

  // Get single complaint with full details and image URLs
  async getComplaintById(
    complaintId: string,
    userId: string,
    userRole: Role,
    userSocietyId: string
  ) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true, email: true } },
        flat: {
          select: {
            id: true,
            flatNumber: true,
            block: {
              select: {
                name: true,
              },
            },
          },
        },
        assignedTo: { select: { id: true, name: true, phone: true } },
        resolvedBy: { select: { id: true, name: true, phone: true } },
        society: { select: { id: true, name: true } },
      },
    });

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    // Access control - society members can view society complaints
    if (userRole === 'SUPER_ADMIN') {
      // Can see any complaint
    } else if (userRole === 'ADMIN' || userRole === 'RESIDENT') {
      // Can see any complaint in their society
      if (complaint.societyId !== userSocietyId) {
        throw new AppError('Access denied. Complaint not in your society.', 403);
      }
    } else {
      throw new AppError('Access denied.', 403);
    }

    const isOwn = complaint.reportedById === userId;

    // Generate view URLs for images
    const imageUrls = await this.generateImageUrls(complaint.images || []);

    // Hide reporter details if anonymous (unless own complaint or ADMIN/SUPER_ADMIN)
    const canSeeReporterDetails = isOwn || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const shouldHideReporter = complaint.isAnonymous && !canSeeReporterDetails;

    const reportedBy = shouldHideReporter ? null : complaint.reportedBy;
    const flat = shouldHideReporter ? null : complaint.flat;

    return {
      ...complaint,
      reportedBy,
      flat,
      isOwn,
      imageUrls,
    };
  }

  // Admin updates complaint status
  async updateComplaintStatus(
    complaintId: string,
    status: ComplaintStatus,
    adminSocietyId: string
  ) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    if (complaint.societyId !== adminSocietyId) {
      throw new AppError('Access denied. Complaint not in your society.', 403);
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: { status },
    });

    return updatedComplaint;
  }

  // Admin assigns complaint
  async assignComplaint(
    complaintId: string,
    assignedToId: string,
    adminSocietyId: string
  ) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    if (complaint.societyId !== adminSocietyId) {
      throw new AppError('Access denied. Complaint not in your society.', 403);
    }

    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
    });

    if (!assignee) {
      throw new AppError('Assignee not found', 404);
    }

    if (assignee.societyId !== adminSocietyId) {
      throw new AppError('Can only assign to staff in your society', 403);
    }

    const updatedComplaint = await prisma.complaint.update({
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

  // Admin resolves complaint
  async resolveComplaint(
    complaintId: string,
    resolution: string,
    resolvedById: string,
    adminSocietyId: string
  ) {
    if (!resolution || resolution.trim().length === 0) {
      throw new AppError('Resolution is required', 400);
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    if (complaint.societyId !== adminSocietyId) {
      throw new AppError('Access denied. Complaint not in your society.', 403);
    }

    const updatedComplaint = await prisma.complaint.update({
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

  // Resident deletes own complaint (within 24 hours and before admin action)
  async deleteComplaint(complaintId: string, userId: string) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    // Only complaint reporter can delete
    if (complaint.reportedById !== userId) {
      throw new AppError('You can only delete your own complaints', 403);
    }

    // Can't delete if status has changed from OPEN (admin has taken action)
    if (complaint.status !== 'OPEN') {
      throw new AppError('Cannot delete complaint after admin has taken action', 400);
    }

    // Can't delete after 24 hours
    const hoursSinceCreation = (Date.now() - complaint.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new AppError('Cannot delete complaint after 24 hours. Please contact admin.', 400);
    }

    await prisma.complaint.delete({
      where: { id: complaintId },
    });

    return { message: 'Complaint deleted successfully' };
  }
}
