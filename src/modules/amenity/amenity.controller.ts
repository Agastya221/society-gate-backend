import type { Response, Request } from 'express';
import { AmenityService } from './amenity.service';

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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create amenity',
    });
  }
};

export const getAmenities = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const amenities = await amenityService.getAmenities(filters);

    res.status(200).json({
      success: true,
      data: amenities,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch amenities',
    });
  }
};

export const getAmenityById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const amenity = await amenityService.getAmenityById(id);

    res.status(200).json({
      success: true,
      data: amenity,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch amenity',
    });
  }
};

export const updateAmenity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const amenity = await amenityService.updateAmenity(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Amenity updated successfully',
      data: amenity,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update amenity',
    });
  }
};

export const deleteAmenity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await amenityService.deleteAmenity(id);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to delete amenity',
    });
  }
};

// Booking management
export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const booking = await amenityService.createBooking(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create booking',
    });
  }
};

export const getBookings = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await amenityService.getBookings(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch bookings',
    });
  }
};

export const approveBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await amenityService.approveBooking(id);

    res.status(200).json({
      success: true,
      message: 'Booking approved successfully',
      data: booking,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to approve booking',
    });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user.id;
    const booking = await amenityService.cancelBooking(id, reason, userId);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to cancel booking',
    });
  }
};
