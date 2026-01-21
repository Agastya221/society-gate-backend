import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { validateRequiredFields } from '../../utils/validation';
import { ComplaintCategory, ComplaintStatus, ComplaintPriority, Role } from '../../../prisma/generated/prisma/enums';

export class ComplaintService {
  // Resident creates complaint with photos
  async createComplaint(
    data: {
      category: ComplaintCategory;
      priority?: ComplaintPriority;
      title: string;
      description: string;
      images?: string[]; // Array of S3 URLs
      location?: string;
      isAnonymous?: boolean;
    },
    reportedById: string,
    societyId: string,
    flatId: string | null
  ) {
    // Validate required fields
    validateRequiredFields(data, ['category', 'title', 'description'], 'Complaint');

    // Validate images array if provided
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
        flat: true,
        society: { select: { id: true, name: true } },
      },
    });

    return complaint;
  }

  // Get complaints (filtered by role)
  async getComplaints(
    filters: any,
    userId: string,
    userRole: Role,
    userSocietyId: string,
    userFlatId: string | null
  ) {
    const { category, status, priority, page = 1, limit = 20 } = filters;

    const where: any = {};

    // SUPER_ADMIN can see all complaints
    if (userRole === 'SUPER_ADMIN') {
      // No filter
    } else if (userRole === 'ADMIN') {
      // Admin sees all complaints in their society
      where.societyId = userSocietyId;
    } else {
      // Resident sees only their own complaints
      where.reportedById = userId;
    }

    // Apply additional filters
    if (category) where.category = category;
    if (status) where.status = status;
    if (priority) where.priority = priority;

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
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      complaints,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // Get single complaint (Admin sees all details including photos)
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

    // Access control
    if (userRole === 'SUPER_ADMIN') {
      // Can see any complaint
    } else if (userRole === 'ADMIN') {
      // Admin can only see complaints in their society
      if (complaint.societyId !== userSocietyId) {
        throw new AppError('Access denied. Complaint not in your society.', 403);
      }
    } else {
      // Resident can only see their own complaints
      if (complaint.reportedById !== userId) {
        throw new AppError('Access denied. You can only view your own complaints.', 403);
      }
    }

    return complaint;
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

    // Society isolation check
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

    // Society isolation check
    if (complaint.societyId !== adminSocietyId) {
      throw new AppError('Access denied. Complaint not in your society.', 403);
    }

    // Check if assignee exists and is in same society
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

    // Society isolation check
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

  // Resident deletes their own complaint
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

    // Can't delete resolved complaints
    if (complaint.status === 'RESOLVED') {
      throw new AppError('Cannot delete resolved complaints', 400);
    }

    await prisma.complaint.delete({
      where: { id: complaintId },
    });

    return { message: 'Complaint deleted successfully' };
  }
}
