import { Router } from 'express';
import {
  createAmenity,
  getAmenities,
  getAmenityById,
  updateAmenity,
  deleteAmenity,
  createBooking,
  getBookings,
  approveBooking,
  cancelBooking,
} from './amenity.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// Amenity routes
router.get('/amenities', authenticate, getAmenities);
router.get('/amenities/:id', authenticate, getAmenityById);
router.post('/amenities', authenticate, authorize('ADMIN'), createAmenity);
router.patch('/amenities/:id', authenticate, authorize('ADMIN'), updateAmenity);
router.delete('/amenities/:id', authenticate, authorize('ADMIN'), deleteAmenity);

// Booking routes
router.post('/bookings', authenticate, authorize('RESIDENT', 'ADMIN'), createBooking);
router.get('/bookings', authenticate, getBookings);
router.patch('/bookings/:id/approve', authenticate, authorize('ADMIN'), approveBooking);
router.patch('/bookings/:id/cancel', authenticate, cancelBooking);

export default router;
