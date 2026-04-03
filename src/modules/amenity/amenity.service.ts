import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type {
  CreateAmenityDTO,
  UpdateAmenityDTO,
  AmenityFilters,
  CreateBookingDTO,
  BookingFilters,
  BookSlotDTO,
  Prisma,
} from '../../types';

export class AmenityService {
  // Admin: Create amenity
  async createAmenity(data: CreateAmenityDTO) {
    const amenity = await prisma.amenity.create({
      data,
      include: {
        society: { select: { id: true, name: true } },
      },
    });

    return amenity;
  }

  // Get all amenities
  async getAmenities(filters: AmenityFilters) {
    const { societyId, type, isActive } = filters;

    const where: Prisma.AmenityWhereInput = { societyId };
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;

    const amenities = await prisma.amenity.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return amenities;
  }

  // Get amenity by ID
  async getAmenityById(amenityId: string) {
    const amenity = await prisma.amenity.findUnique({
      where: { id: amenityId },
    });

    if (!amenity) {
      throw new AppError('Amenity not found', 404);
    }

    return amenity;
  }

  // Admin: Update amenity
  async updateAmenity(amenityId: string, data: UpdateAmenityDTO) {
    const amenity = await prisma.amenity.findUnique({
      where: { id: amenityId },
    });

    if (!amenity) {
      throw new AppError('Amenity not found', 404);
    }

    const updatedAmenity = await prisma.amenity.update({
      where: { id: amenityId },
      data,
    });

    return updatedAmenity;
  }

  // Admin: Delete amenity
  async deleteAmenity(amenityId: string) {
    const amenity = await prisma.amenity.findUnique({
      where: { id: amenityId },
    });

    if (!amenity) {
      throw new AppError('Amenity not found', 404);
    }

    await prisma.amenity.delete({
      where: { id: amenityId },
    });

    return { message: 'Amenity deleted successfully' };
  }

  // Create booking
  async createBooking(data: CreateBookingDTO, userId: string) {
    const { amenityId, bookingDate, startTime, endTime } = data;

    // Use transaction to prevent double-booking race condition
    const booking = await prisma.$transaction(async (tx) => {
      // Check if amenity exists and is active
      const amenity = await tx.amenity.findUnique({
        where: { id: amenityId },
      });

      if (!amenity || !amenity.isActive) {
        throw new AppError('Amenity not found or inactive', 404);
      }

      // Check for overlapping bookings (not just exact match)
      // Convert times to comparable format (minutes from midnight)
      const toMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const requestedStart = toMinutes(startTime);
      const requestedEnd = toMinutes(endTime);

      // Validate time range
      if (requestedEnd <= requestedStart) {
        throw new AppError('End time must be after start time', 400);
      }

      // Get all bookings for this amenity on this date
      const existingBookings = await tx.amenityBooking.findMany({
        where: {
          amenityId,
          bookingDate: new Date(bookingDate),
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { startTime: true, endTime: true },
      });

      // Check for time overlaps
      for (const booking of existingBookings) {
        const existingStart = toMinutes(booking.startTime);
        const existingEnd = toMinutes(booking.endTime);

        // Overlap exists if: requestedStart < existingEnd AND requestedEnd > existingStart
        if (requestedStart < existingEnd && requestedEnd > existingStart) {
          throw new AppError(
            `Time slot overlaps with existing booking (${booking.startTime} - ${booking.endTime})`,
            400
          );
        }
      }

      // Check user's active bookings limit
      const activeBookings = await tx.amenityBooking.count({
        where: {
          userId,
          amenityId,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      });

      if (activeBookings >= amenity.maxBookingsPerUser) {
        throw new AppError(`Maximum ${amenity.maxBookingsPerUser} active bookings allowed`, 400);
      }

      // Create booking atomically
      const newBooking = await tx.amenityBooking.create({
        data: {
          ...data,
          userId,
          bookingDate: new Date(bookingDate),
          status: 'CONFIRMED',
        },
        include: {
          amenity: true,
          user: { select: { id: true, name: true, phone: true } },
          flat: true,
        },
      });

      return newBooking;
    });

    return booking;
  }

  // Get bookings
  async getBookings(filters: BookingFilters) {
    const { societyId, amenityId, userId, status, bookingDate, page = 1, limit = 20 } = filters;

    const where: Prisma.AmenityBookingWhereInput = { societyId };
    if (amenityId) where.amenityId = amenityId;
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (bookingDate) {
      const date = new Date(bookingDate);
      where.bookingDate = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    const [bookings, total] = await Promise.all([
      prisma.amenityBooking.findMany({
        where,
        include: {
          amenity: true,
          user: { select: { id: true, name: true, phone: true } },
          flat: true,
        },
        orderBy: { bookingDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.amenityBooking.count({ where }),
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

  // Approve booking (Admin)
  async approveBooking(bookingId: string) {
    const booking = await prisma.amenityBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.status !== 'PENDING') {
      throw new AppError('Booking is not pending', 400);
    }

    const updatedBooking = await prisma.amenityBooking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
      include: {
        amenity: true,
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    return updatedBooking;
  }

  // Cancel booking
  async cancelBooking(bookingId: string, reason: string, userId: string) {
    const booking = await prisma.amenityBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.userId !== userId) {
      throw new AppError('You can only cancel your own bookings', 403);
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      throw new AppError('Cannot cancel this booking', 400);
    }

    const updatedBooking = await prisma.amenityBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    return updatedBooking;
  }

  // Get fixed slot blocks for a given date
  async getSlots(amenityId: string, date: string) {
    const amenity = await prisma.amenity.findUnique({ where: { id: amenityId } });
    if (!amenity || !amenity.isActive) {
      throw new AppError('Amenity not found or inactive', 404);
    }

    const openTime = amenity.openTime ?? '06:00';
    const closeTime = amenity.closeTime ?? '22:00';
    const slotDurationHours = amenity.slotDurationHours ?? 1;
    const maxCapacity = amenity.capacity ?? 1;

    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const toTimeStr = (minutes: number) => {
      const h = Math.floor(minutes / 60).toString().padStart(2, '0');
      const m = (minutes % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    const openMin = toMinutes(openTime);
    const closeMin = toMinutes(closeTime);
    const slotMin = slotDurationHours * 60;

    // Build slot list
    const slots: { id: string; startTime: string; endTime: string }[] = [];
    for (let start = openMin; start + slotMin <= closeMin; start += slotMin) {
      const startStr = toTimeStr(start);
      const endStr = toTimeStr(start + slotMin);
      slots.push({
        id: `${amenityId}_${date}_${startStr}`,
        startTime: startStr,
        endTime: endStr,
      });
    }

    // Fetch confirmed/pending bookings for this amenity+date
    const bookingDate = new Date(date);
    const existingBookings = await prisma.amenityBooking.findMany({
      where: {
        amenityId,
        bookingDate: {
          gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
          lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true, guestCount: true },
    });

    return slots.map((slot) => {
      const bookedGuests = existingBookings
        .filter((b) => b.startTime === slot.startTime && b.endTime === slot.endTime)
        .reduce((sum, b) => sum + (b.guestCount ?? 1), 0);

      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBooked: bookedGuests >= maxCapacity,
        availableCapacity: Math.max(0, maxCapacity - bookedGuests),
      };
    });
  }

  // Book by slotId (frontend-facing)
  async bookSlot(amenityId: string, data: BookSlotDTO, userId: string) {
    const { slotId, date, members, purpose } = data;

    // Derive startTime/endTime from slotId: "<amenityId>_<date>_<HH:MM>"
    const parts = slotId.split('_');
    // slotId format: <uuid(36chars)>_<YYYY-MM-DD>_<HH:MM>
    // amenityId is a UUID (contains hyphens), date is YYYY-MM-DD, time is HH:MM
    // parts after splitting by _ are variable due to UUID hyphens
    // safer: strip amenityId + date prefix from slotId
    const prefix = `${amenityId}_${date}_`;
    if (!slotId.startsWith(prefix)) {
      throw new AppError('Invalid slotId', 400);
    }
    const startTime = slotId.slice(prefix.length);

    const amenity = await prisma.amenity.findUnique({ where: { id: amenityId } });
    if (!amenity || !amenity.isActive) {
      throw new AppError('Amenity not found or inactive', 404);
    }

    const slotDurationHours = amenity.slotDurationHours ?? 1;
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const toTimeStr = (minutes: number) => {
      const h = Math.floor(minutes / 60).toString().padStart(2, '0');
      const m = (minutes % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };
    const endTime = toTimeStr(toMinutes(startTime) + slotDurationHours * 60);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true, societyId: true },
    });
    if (!user?.flatId || !user.societyId) {
      throw new AppError('User must be assigned to a flat', 400);
    }

    return this.createBooking(
      {
        amenityId,
        flatId: user.flatId,
        societyId: user.societyId,
        bookingDate: new Date(date),
        startTime,
        endTime,
        guestCount: members ? members.length + 1 : 1,
        purpose,
      },
      userId
    );
  }
}
