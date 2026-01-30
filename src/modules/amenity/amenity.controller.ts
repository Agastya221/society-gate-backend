import type { Response, Request } from 'express';
import { AmenityService } from './amenity.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { AmenityFilters, BookingFilters, AmenityType, BookingStatus } from '../../types';

const amenityService = new AmenityService();

// Amenity management
export const createAmenity = async (req: Request, res: Response) => {
  try {
    const amenity = await amenityService.createAmenity(req.body);

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
      societyId: req.user!.societyId!,
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
    const amenity = await amenityService.getAmenityById(String(id));

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
    const amenity = await amenityService.updateAmenity(String(id), req.body);

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
    const result = await amenityService.deleteAmenity(String(id));

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
    const booking = await amenityService.createBooking(req.body, userId);

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

export const getBookings = async (req: Request, res: Response) => {
  try {
    const filters: BookingFilters = {
      societyId: req.user!.societyId!,
      amenityId: req.query.amenityId as string | undefined,
      userId: req.query.userId as string | undefined,
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
    const booking = await amenityService.approveBooking(String(id));

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
    const booking = await amenityService.cancelBooking(String(id), reason, userId);

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
