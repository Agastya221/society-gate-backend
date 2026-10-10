import type { Response, Request } from 'express';
import { AmenityService, type BookingCaller } from './amenity.service';
import { getSocietyId } from '../../utils/scope';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { AmenityFilters, BookingFilters, AmenityType, BookingStatus } from '../../types';

const amenityService = new AmenityService();

const bookingCallerOf = (req: Request): BookingCaller => ({
  role: req.user!.role,
  flatId: req.user!.flatId ?? null,
  societyId: getSocietyId(req),
});

// Amenity management
export const createAmenity = async (req: Request, res: Response) => {
  try {
    const amenity = await amenityService.createAmenity(req.body, getSocietyId(req));

    res.status(201).json({
      success: true,
      message: 'Amenity created successfully',
      data: amenity,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getAmenities = async (req: Request, res: Response) => {
  try {
    const filters: AmenityFilters = {
      societyId: getSocietyId(req),
      type: req.query.type as AmenityType | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const amenities = await amenityService.getAmenities(filters);

    res.status(200).json({
      success: true,
      data: amenities,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getAmenityById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const amenity = await amenityService.getAmenityById(String(id), getSocietyId(req));

    res.status(200).json({
      success: true,
      data: amenity,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const updateAmenity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const amenity = await amenityService.updateAmenity(String(id), req.body, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Amenity updated successfully',
      data: amenity,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const deleteAmenity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await amenityService.deleteAmenity(String(id), getSocietyId(req));

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// Booking management
export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const booking = await amenityService.createBooking(req.body, userId, bookingCallerOf(req));

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const filters: BookingFilters = {
      societyId: getSocietyId(req),
      userId: req.user!.id, // always scoped to the logged-in user
      status: req.query.status as BookingStatus | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await amenityService.getBookings(filters);

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getBookings = async (req: Request, res: Response) => {
  try {
    const filters: BookingFilters = {
      societyId: getSocietyId(req),
      amenityId: req.query.amenityId as string | undefined,
      // Admins may look at anyone's bookings; everyone else only sees their own.
      userId: ['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)
        ? (req.query.userId as string | undefined)
        : req.user!.id,
      status: req.query.status as BookingStatus | undefined,
      bookingDate: req.query.bookingDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await amenityService.getBookings(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const approveBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await amenityService.approveBooking(String(id), getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Booking approved successfully',
      data: booking,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;
    const booking = await amenityService.cancelBooking(String(id), reason, userId, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getSlots = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param is required (YYYY-MM-DD)' });
    }
    const slots = await amenityService.getSlots(String(id), date, getSocietyId(req), {
      userId: req.user?.id,
      flatId: req.user?.flatId ?? null,
    });
    return res.status(200).json({ success: true, data: slots });
  } catch (error: unknown) {
    return res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const bookSlot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const booking = await amenityService.bookSlot(String(id), req.body, userId, bookingCallerOf(req));
    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { id: booking.id, status: booking.status },
    });
  } catch (error: unknown) {
    return res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
