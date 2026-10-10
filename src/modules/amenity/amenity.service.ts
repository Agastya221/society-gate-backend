import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { findInSociety, clampPagination } from '../../utils/scope';
import type {
  CreateAmenityDTO,
  UpdateAmenityDTO,
  AmenityFilters,
  CreateBookingDTO,
  BookingFilters,
  BookSlotDTO,
  Prisma,
} from '../../types';

/** Who is booking, so the booking can be tied to their society and flat. */
export interface BookingCaller {
  role: string;
  flatId: string | null;
  societyId: string;
}

const isSocietyAdmin = (role: string) => role === 'ADMIN' || role === 'SUPER_ADMIN';

export class AmenityService {
  // Admin: Create amenity
  async createAmenity(data: CreateAmenityDTO, societyId: string) {
    const amenity = await prisma.amenity.create({
      data: { ...data, societyId },
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
  async getAmenityById(amenityId: string, societyId: string) {
    const amenity = await findInSociety(prisma.amenity, amenityId, societyId, { entity: 'Amenity' });

    return amenity;
  }

  // Admin: Update amenity
  async updateAmenity(amenityId: string, data: UpdateAmenityDTO, societyId: string) {
    await findInSociety(prisma.amenity, amenityId, societyId, { entity: 'Amenity', select: { id: true } });

    const updatedAmenity = await prisma.amenity.update({
      where: { id: amenityId },
      data,
    });

    return updatedAmenity;
  }

  // Admin: Delete amenity
  async deleteAmenity(amenityId: string, societyId: string) {
    await findInSociety(prisma.amenity, amenityId, societyId, { entity: 'Amenity', select: { id: true } });

    await prisma.amenity.delete({
      where: { id: amenityId },
    });

    return { message: 'Amenity deleted successfully' };
  }

  // Create booking
  async createBooking(data: CreateBookingDTO, userId: string, caller: BookingCaller) {
    const { amenityId, bookingDate, startTime, endTime } = data;
    const { societyId } = caller;

    // Residents always book for their own flat; admins may name a flat, but it
    // must be in their society.
    const flatId = isSocietyAdmin(caller.role) ? (data.flatId || caller.flatId) : caller.flatId;
    if (!flatId) {
      throw new AppError('User must be assigned to a flat', 400);
    }
    if (isSocietyAdmin(caller.role)) {
      await findInSociety(prisma.flat, flatId, societyId, { entity: 'Flat', select: { id: true } });
    }

    // Use transaction to prevent double-booking race condition
    const booking = await prisma.$transaction(async (tx) => {
      // Check if amenity exists and is active
      const amenity = typeof amenityId === 'string'
        ? await tx.amenity.findFirst({ where: { id: amenityId, societyId } })
        : null;

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
          flatId,
          societyId,
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
    const { societyId, amenityId, userId, status, bookingDate } = filters;
    const { page, limit, skip } = clampPagination(filters.page, filters.limit);

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
        skip,
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
  async approveBooking(bookingId: string, societyId: string) {
    const booking = await findInSociety(prisma.amenityBooking, bookingId, societyId, { entity: 'Booking' });

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
  async cancelBooking(bookingId: string, reason: string, userId: string, societyId: string) {
    const booking = await findInSociety(prisma.amenityBooking, bookingId, societyId, { entity: 'Booking' });

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

  // Get fixed slot blocks for a given date — rich availability data for UI
  // `viewer` (optional) marks slots booked by the caller's flat (or by the caller) with bookedByMe
  async getSlots(amenityId: string, date: string, societyId: string, viewer?: { userId?: string; flatId?: string | null }) {
    const amenity = await findInSociety(prisma.amenity, amenityId, societyId, { entity: 'Amenity' });
    if (!amenity.isActive) {
      throw new AppError('Amenity not found or inactive', 404);
    }

    const openTime = amenity.openTime ?? '06:00';
    const closeTime = amenity.closeTime ?? '22:00';
    const slotDurationHours = amenity.slotDurationHours ?? 1;
    const totalCapacity = amenity.capacity ?? 1;

    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const toTimeStr = (minutes: number) => {
      const h = Math.floor(minutes / 60).toString().padStart(2, '0');
      const m = (minutes % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };
    const to12h = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
    };

    const openMin = toMinutes(openTime);
    const closeMin = toMinutes(closeTime);
    const slotMin = slotDurationHours * 60;

    // Current time in IST minutes (for marking past slots)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const isToday = date === todayStr;
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Build slot list
    const slots: { id: string; startTime: string; endTime: string; startMin: number }[] = [];
    for (let start = openMin; start + slotMin <= closeMin; start += slotMin) {
      const startStr = toTimeStr(start);
      const endStr = toTimeStr(start + slotMin);
      slots.push({ id: `${amenityId}_${date}_${startStr}`, startTime: startStr, endTime: endStr, startMin: start });
    }

    // Fetch all confirmed bookings for this amenity+date in one query
    const existingBookings = await prisma.amenityBooking.findMany({
      where: {
        amenityId,
        bookingDate: {
          gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
          lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
        },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      select: { startTime: true, endTime: true, guestCount: true, userId: true, flatId: true },
    });

    const isMine = (b: { userId: string; flatId: string }) =>
      (!!viewer?.flatId && b.flatId === viewer.flatId) || (!!viewer?.userId && b.userId === viewer.userId);

    return slots.map((slot) => {
      const slotBookings = existingBookings.filter(
        (b) => b.startTime === slot.startTime && b.endTime === slot.endTime
      );
      const isBooked = slotBookings.length > 0;
      const bookedByMe = slotBookings.some(isMine);
      const isPast = isToday && slot.startMin < nowMin;

      const status: 'AVAILABLE' | 'BOOKED' | 'PAST' =
        isPast ? 'PAST' : isBooked ? 'BOOKED' : 'AVAILABLE';

      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        label: `${to12h(slot.startTime)} – ${to12h(slot.endTime)}`,
        status,           // AVAILABLE | BOOKED | PAST
        isBookable: status === 'AVAILABLE',
        bookedByMe,       // true when the CONFIRMED/PENDING booking belongs to the caller's flat
      };
    });
  }

  // Book by slotId (frontend-facing)
  async bookSlot(amenityId: string, data: BookSlotDTO, userId: string, caller: BookingCaller) {
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

    const amenity = await findInSociety(prisma.amenity, amenityId, caller.societyId, { entity: 'Amenity' });
    if (!amenity.isActive) {
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

    if (!caller.flatId) {
      throw new AppError('User must be assigned to a flat', 400);
    }

    return this.createBooking(
      {
        amenityId,
        flatId: caller.flatId,
        societyId: caller.societyId,
        bookingDate: new Date(date),
        startTime,
        endTime,
        guestCount: members ? members.length + 1 : 1,
        purpose,
      },
      userId,
      caller
    );
  }
}
