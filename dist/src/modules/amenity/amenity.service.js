"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmenityService = void 0;
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
class AmenityService {
    // Admin: Create amenity
    async createAmenity(data) {
        const amenity = await Client_1.prisma.amenity.create({
            data,
            include: {
                society: { select: { id: true, name: true } },
            },
        });
        return amenity;
    }
    // Get all amenities
    async getAmenities(filters) {
        const { societyId, type, isActive = true } = filters;
        const where = { societyId };
        if (type)
            where.type = type;
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const amenities = await Client_1.prisma.amenity.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        return amenities;
    }
    // Get amenity by ID
    async getAmenityById(amenityId) {
        const amenity = await Client_1.prisma.amenity.findUnique({
            where: { id: amenityId },
        });
        if (!amenity) {
            throw new ResponseHandler_1.AppError('Amenity not found', 404);
        }
        return amenity;
    }
    // Admin: Update amenity
    async updateAmenity(amenityId, data) {
        const amenity = await Client_1.prisma.amenity.findUnique({
            where: { id: amenityId },
        });
        if (!amenity) {
            throw new ResponseHandler_1.AppError('Amenity not found', 404);
        }
        const updatedAmenity = await Client_1.prisma.amenity.update({
            where: { id: amenityId },
            data,
        });
        return updatedAmenity;
    }
    // Admin: Delete amenity
    async deleteAmenity(amenityId) {
        const amenity = await Client_1.prisma.amenity.findUnique({
            where: { id: amenityId },
        });
        if (!amenity) {
            throw new ResponseHandler_1.AppError('Amenity not found', 404);
        }
        await Client_1.prisma.amenity.delete({
            where: { id: amenityId },
        });
        return { message: 'Amenity deleted successfully' };
    }
    // Create booking
    async createBooking(data, userId) {
        const { amenityId, bookingDate, startTime, endTime } = data;
        // Use transaction to prevent double-booking race condition
        const booking = await Client_1.prisma.$transaction(async (tx) => {
            // Check if amenity exists and is active
            const amenity = await tx.amenity.findUnique({
                where: { id: amenityId },
            });
            if (!amenity || !amenity.isActive) {
                throw new ResponseHandler_1.AppError('Amenity not found or inactive', 404);
            }
            // Check for existing booking at the same time
            const existingBooking = await tx.amenityBooking.findFirst({
                where: {
                    amenityId,
                    bookingDate: new Date(bookingDate),
                    startTime,
                    status: { in: ['PENDING', 'CONFIRMED'] },
                },
            });
            if (existingBooking) {
                throw new ResponseHandler_1.AppError('This time slot is already booked', 400);
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
                throw new ResponseHandler_1.AppError(`Maximum ${amenity.maxBookingsPerUser} active bookings allowed`, 400);
            }
            // Create booking atomically
            const newBooking = await tx.amenityBooking.create({
                data: {
                    ...data,
                    userId,
                    bookingDate: new Date(bookingDate),
                    status: 'PENDING',
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
    async getBookings(filters) {
        const { societyId, amenityId, userId, status, bookingDate, page = 1, limit = 20 } = filters;
        const where = { societyId };
        if (amenityId)
            where.amenityId = amenityId;
        if (userId)
            where.userId = userId;
        if (status)
            where.status = status;
        if (bookingDate) {
            const date = new Date(bookingDate);
            where.bookingDate = {
                gte: new Date(date.setHours(0, 0, 0, 0)),
                lt: new Date(date.setHours(23, 59, 59, 999)),
            };
        }
        const [bookings, total] = await Promise.all([
            Client_1.prisma.amenityBooking.findMany({
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
            Client_1.prisma.amenityBooking.count({ where }),
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
    async approveBooking(bookingId) {
        const booking = await Client_1.prisma.amenityBooking.findUnique({
            where: { id: bookingId },
        });
        if (!booking) {
            throw new ResponseHandler_1.AppError('Booking not found', 404);
        }
        if (booking.status !== 'PENDING') {
            throw new ResponseHandler_1.AppError('Booking is not pending', 400);
        }
        const updatedBooking = await Client_1.prisma.amenityBooking.update({
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
    async cancelBooking(bookingId, reason, userId) {
        const booking = await Client_1.prisma.amenityBooking.findUnique({
            where: { id: bookingId },
        });
        if (!booking) {
            throw new ResponseHandler_1.AppError('Booking not found', 404);
        }
        if (booking.userId !== userId) {
            throw new ResponseHandler_1.AppError('You can only cancel your own bookings', 403);
        }
        if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
            throw new ResponseHandler_1.AppError('Cannot cancel this booking', 400);
        }
        const updatedBooking = await Client_1.prisma.amenityBooking.update({
            where: { id: bookingId },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                cancellationReason: reason,
            },
        });
        return updatedBooking;
    }
}
exports.AmenityService = AmenityService;
