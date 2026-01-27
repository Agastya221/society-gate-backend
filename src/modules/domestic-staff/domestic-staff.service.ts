import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { generateQRToken } from '../../utils/QrGenerate';
import { notificationService } from '../notification/notification.service';
import {
  validateRequiredFields,
  validateTimeRange,
  validatePositiveNumber,
  validatePhoneNumber,
} from '../../utils/validation';

export class DomesticStaffService {
  // ============================================
  // STAFF MANAGEMENT
  // ============================================

  async createStaff(data: any, addedById: string) {
    const { societyId, phone } = data;

    // Check if staff with this phone already exists in society
    const existing = await prisma.domesticStaff.findFirst({
      where: { phone, societyId },
    });

    if (existing) {
      throw new AppError('Staff with this phone number already exists in your society', 400);
    }

    // Generate QR token
    const qrToken =  generateQRToken({
      type: 'domestic_staff',
      phone,
      societyId,
    });

    const staff = await prisma.domesticStaff.create({
      data: {
        ...data,
        qrToken,
        addedById,
      },
      include: {
        addedBy: { select: { id: true, name: true, role: true } },
        society: { select: { id: true, name: true } },
      },
    });

    return staff;
  }

  async getStaffList(filters: any) {
    const {
      societyId,
      staffType,
      availabilityStatus,
      isVerified,
      isActive = true,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { societyId };
    if (staffType) where.staffType = staffType;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';
    if (isActive !== undefined) where.isActive = isActive === 'true';

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [staff, total] = await Promise.all([
      prisma.domesticStaff.findMany({
        where,
        include: {
          assignedFlats: {
            include: {
              flat: true,
            },
          },
        },
        orderBy: [
          { isVerified: 'desc' },
          { rating: 'desc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.domesticStaff.count({ where }),
    ]);

    return {
      staff,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getStaffById(staffId: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
      include: {
        addedBy: { select: { id: true, name: true, role: true } },
        assignedFlats: {
          include: {
            flat: true,
          },
        },
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!staff) {
      throw new AppError('Staff not found', 404);
    }

    return staff;
  }

  async updateStaff(staffId: string, data: any) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new AppError('Staff not found', 404);
    }

    const updatedStaff = await prisma.domesticStaff.update({
      where: { id: staffId },
      data,
    });

    return updatedStaff;
  }

  async deleteStaff(staffId: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new AppError('Staff not found', 404);
    }

    await prisma.domesticStaff.delete({
      where: { id: staffId },
    });

    return { message: 'Staff deleted successfully' };
  }

  async verifyStaff(staffId: string, verifiedBy: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new AppError('Staff not found', 404);
    }

    const updatedStaff = await prisma.domesticStaff.update({
      where: { id: staffId },
      data: {
        isVerified: !staff.isVerified,
        verifiedAt: !staff.isVerified ? new Date() : null,
        verifiedBy: !staff.isVerified ? verifiedBy : null,
      },
    });

    return updatedStaff;
  }

  // ============================================
  // FLAT ASSIGNMENTS
  // ============================================

  async assignStaffToFlat(data: any) {
    const { domesticStaffId, flatId } = data;

    // Check if assignment already exists
    const existing = await prisma.staffFlatAssignment.findUnique({
      where: {
        domesticStaffId_flatId: {
          domesticStaffId,
          flatId,
        },
      },
    });

    if (existing) {
      throw new AppError('Staff is already assigned to this flat', 400);
    }

    const assignment = await prisma.staffFlatAssignment.create({
      data,
      include: {
        domesticStaff: true,
        flat: true,
      },
    });

    return assignment;
  }

  async updateAssignment(assignmentId: string, data: any) {
    const assignment = await prisma.staffFlatAssignment.update({
      where: { id: assignmentId },
      data,
    });

    return assignment;
  }

  async removeAssignment(assignmentId: string) {
    await prisma.staffFlatAssignment.delete({
      where: { id: assignmentId },
    });

    return { message: 'Assignment removed successfully' };
  }

  async getStaffAssignments(staffId: string) {
    const assignments = await prisma.staffFlatAssignment.findMany({
      where: { domesticStaffId: staffId },
      include: {
        flat: true,
      },
    });

    return assignments;
  }

  // ============================================
  // ATTENDANCE & CHECK-IN/OUT
  // ============================================

  async checkIn(data: any, verifiedByGuardId?: string) {
    const { domesticStaffId, flatId, societyId, checkInMethod = 'QR', notes } = data;

    // Use transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check if staff is active and not already checked in (with SELECT FOR UPDATE semantics)
      const staff = await tx.domesticStaff.findUnique({
        where: { id: domesticStaffId },
      });

      if (!staff || !staff.isActive) {
        throw new AppError('Staff not found or inactive', 404);
      }

      // Check if already checked in
      if (staff.isCurrentlyWorking) {
        throw new AppError('Staff is already checked in', 400);
      }

      // Create attendance record and update staff status atomically
      const attendance = await tx.staffAttendance.create({
        data: {
          domesticStaffId,
          flatId,
          societyId,
          checkInTime: new Date(),
          checkInMethod,
          notes,
          verifiedByGuardId,
        },
        include: {
          domesticStaff: true,
          flat: true,
        },
      });

      // Update staff status
      await tx.domesticStaff.update({
        where: { id: domesticStaffId },
        data: {
          isCurrentlyWorking: true,
          currentFlatId: flatId,
          lastCheckIn: new Date(),
          availabilityStatus: 'BUSY',
        },
      });

      return attendance;
    });

    // Send notification to flat residents about staff check-in
    await notificationService.sendToFlat(flatId, {
      type: 'STAFF_CHECKIN',
      title: 'Staff Check-In',
      message: `${result.domesticStaff.name} (${result.domesticStaff.staffType}) has checked in`,
      data: {
        staffId: domesticStaffId,
        staffName: result.domesticStaff.name,
        staffType: result.domesticStaff.staffType,
        checkInTime: result.checkInTime,
      },
      referenceId: result.id,
      referenceType: 'StaffAttendance',
      societyId,
    });

    return result;
  }

  async checkOut(domesticStaffId: string, workCompleted?: string) {
    // Use transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.domesticStaff.findUnique({
        where: { id: domesticStaffId },
      });

      if (!staff || !staff.isCurrentlyWorking) {
        throw new AppError('Staff is not currently checked in', 400);
      }

      // Find the latest uncompleted attendance
      const attendance = await tx.staffAttendance.findFirst({
        where: {
          domesticStaffId,
          checkOutTime: null,
        },
        orderBy: { checkInTime: 'desc' },
      });

      if (!attendance) {
        throw new AppError('No active check-in found', 404);
      }

      const checkOutTime = new Date();
      const duration = Math.floor((checkOutTime.getTime() - attendance.checkInTime.getTime()) / 60000);

      // Update attendance
      const updatedAttendance = await tx.staffAttendance.update({
        where: { id: attendance.id },
        data: {
          checkOutTime,
          duration,
          checkOutMethod: 'QR',
          workCompleted,
        },
        include: {
          domesticStaff: true,
          flat: true,
        },
      });

      // Update staff status
      await tx.domesticStaff.update({
        where: { id: domesticStaffId },
        data: {
          isCurrentlyWorking: false,
          currentFlatId: null,
          lastCheckOut: checkOutTime,
          availabilityStatus: 'AVAILABLE',
        },
      });

      return updatedAttendance;
    });

    // Send notification to flat residents about staff check-out
    await notificationService.sendToFlat(result.flatId, {
      type: 'STAFF_CHECKOUT',
      title: 'Staff Check-Out',
      message: `${result.domesticStaff.name} (${result.domesticStaff.staffType}) has checked out. Duration: ${result.duration} minutes`,
      data: {
        staffId: domesticStaffId,
        staffName: result.domesticStaff.name,
        staffType: result.domesticStaff.staffType,
        checkOutTime: result.checkOutTime,
        duration: result.duration,
      },
      referenceId: result.id,
      referenceType: 'StaffAttendance',
      societyId: result.societyId,
    });

    return result;
  }

  async scanQRCode(qrToken: string, flatId: string, societyId: string, verifiedByGuardId?: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { qrToken },
    });

    if (!staff) {
      throw new AppError('Invalid QR code', 404);
    }

    if (!staff.isActive) {
      throw new AppError('Staff is inactive', 400);
    }

    // Check if currently working - if yes, check out; if no, check in
    if (staff.isCurrentlyWorking) {
      return await this.checkOut(staff.id);
    } else {
      return await this.checkIn({
        domesticStaffId: staff.id,
        flatId,
        societyId,
        checkInMethod: 'QR',
      }, verifiedByGuardId);
    }
  }

  async getAttendanceRecords(filters: any) {
    const { domesticStaffId, flatId, societyId, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (domesticStaffId) where.domesticStaffId = domesticStaffId;
    if (flatId) where.flatId = flatId;
    if (societyId) where.societyId = societyId;

    if (startDate && endDate) {
      where.checkInTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [records, total] = await Promise.all([
      prisma.staffAttendance.findMany({
        where,
        include: {
          domesticStaff: true,
          flat: true,
          verifiedByGuard: { select: { id: true, name: true } },
        },
        orderBy: { checkInTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.staffAttendance.count({ where }),
    ]);

    return {
      records,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // BOOKINGS (On-demand/Urgent hiring)
  // ============================================

  async createBooking(data: any, bookedById: string) {
    const { domesticStaffId, flatId, societyId, bookingDate, startTime, endTime, durationHours, workType } = data;

    // Validate required fields
    validateRequiredFields(data, ['domesticStaffId', 'flatId', 'societyId', 'bookingDate', 'startTime', 'endTime', 'durationHours', 'workType'], 'Booking');

    // Validate time format and range
    validateTimeRange(startTime, endTime);

    // Validate duration is positive
    validatePositiveNumber(durationHours, 'Duration hours');

    // Check staff availability
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: domesticStaffId },
    });

    if (!staff || !staff.isActive) {
      throw new AppError('Staff not found or inactive', 404);
    }

    // Check for conflicting bookings
    const conflictingBooking = await prisma.staffBooking.findFirst({
      where: {
        domesticStaffId,
        bookingDate: new Date(bookingDate),
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
        ],
      },
    });

    if (conflictingBooking) {
      throw new AppError('Staff is not available at this time', 400);
    }

    const booking = await prisma.staffBooking.create({
      data: {
        ...data,
        bookedById,
        bookingDate: new Date(bookingDate),
        status: 'PENDING',
      },
      include: {
        domesticStaff: true,
        bookedBy: { select: { id: true, name: true, phone: true } },
        flat: true,
      },
    });

    // TODO: Send notification to staff

    return booking;
  }

  async getBookings(filters: any) {
    const { domesticStaffId, bookedById, flatId, status, bookingDate, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (domesticStaffId) where.domesticStaffId = domesticStaffId;
    if (bookedById) where.bookedById = bookedById;
    if (flatId) where.flatId = flatId;
    if (status) where.status = status;

    if (bookingDate) {
      const date = new Date(bookingDate);
      where.bookingDate = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    const [bookings, total] = await Promise.all([
      prisma.staffBooking.findMany({
        where,
        include: {
          domesticStaff: true,
          bookedBy: { select: { id: true, name: true, phone: true } },
          flat: true,
        },
        orderBy: { bookingDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.staffBooking.count({ where }),
    ]);

    return {
      bookings,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async acceptBooking(bookingId: string) {
    const booking = await prisma.staffBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.status !== 'PENDING') {
      throw new AppError('Booking is not pending', 400);
    }

    const updatedBooking = await prisma.staffBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        acceptedAt: new Date(),
      },
    });

    // TODO: Send notification to resident

    return updatedBooking;
  }

  async rejectBooking(bookingId: string, rejectionReason: string) {
    const booking = await prisma.staffBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    return booking;
  }

  async completeBooking(bookingId: string, actualDuration?: number, finalCost?: number) {
    const booking = await prisma.staffBooking.update({
      where: { id: bookingId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        actualDuration,
        finalCost,
      },
    });

    return booking;
  }

  // ============================================
  // REVIEWS & RATINGS
  // ============================================

  async addReview(data: any, reviewerId: string) {
    const { domesticStaffId, rating } = data;

    const review = await prisma.staffReview.create({
      data: {
        ...data,
        reviewerId,
      },
      include: {
        reviewer: { select: { id: true, name: true } },
        domesticStaff: true,
      },
    });

    // Update staff rating
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: domesticStaffId },
    });

    if (staff) {
      const totalReviews = staff.totalReviews + 1;
      const currentTotal = (staff.rating || 0) * staff.totalReviews;
      const newRating = (currentTotal + rating) / totalReviews;

      await prisma.domesticStaff.update({
        where: { id: domesticStaffId },
        data: {
          rating: newRating,
          totalReviews,
        },
      });
    }

    return review;
  }

  async getStaffReviews(staffId: string) {
    const reviews = await prisma.staffReview.findMany({
      where: { domesticStaffId: staffId },
      include: {
        reviewer: { select: { id: true, name: true } },
        flat: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews;
  }

  // ============================================
  // AVAILABILITY & SCHEDULING
  // ============================================

  async getAvailableStaff(filters: any) {
    const { societyId, staffType, bookingDate, startTime, endTime } = filters;

    const where: any = {
      societyId,
      isActive: true,
      availabilityStatus: 'AVAILABLE',
    };

    if (staffType) where.staffType = staffType;

    const staff = await prisma.domesticStaff.findMany({
      where,
      include: {
        assignedFlats: {
          where: { isActive: true },
          include: { flat: true },
        },
      },
      orderBy: [
        { isVerified: 'desc' },
        { rating: 'desc' },
      ],
    });

    // If date and time provided, filter out staff with conflicting bookings
    if (bookingDate && startTime && endTime) {
      const availableStaff = [];
      for (const s of staff) {
        const hasConflict = await prisma.staffBooking.findFirst({
          where: {
            domesticStaffId: s.id,
            bookingDate: new Date(bookingDate),
            status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            OR: [
              {
                AND: [
                  { startTime: { lte: startTime } },
                  { endTime: { gt: startTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: endTime } },
                  { endTime: { gte: endTime } },
                ],
              },
            ],
          },
        });

        if (!hasConflict) {
          availableStaff.push(s);
        }
      }
      return availableStaff;
    }

    return staff;
  }

  async updateAvailabilityStatus(staffId: string, status: string) {
    const staff = await prisma.domesticStaff.update({
      where: { id: staffId },
      data: { availabilityStatus: status as any },
    });

    return staff;
  }
}
