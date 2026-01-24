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
router.get('/amenities', getAmenities);
router.get('/amenities/:id', getAmenityById);
router.post('/amenities', authorize('ADMIN', 'SUPER_ADMIN'), createAmenity);
router.patch('/amenities/:id', authorize('ADMIN', 'SUPER_ADMIN'), updateAmenity);
router.delete('/amenities/:id', authorize('ADMIN', 'SUPER_ADMIN'), deleteAmenity);

// Booking routes
router.post('/bookings', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), createBooking);
router.get('/bookings', getBookings);
router.patch('/bookings/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), approveBooking);
router.patch('/bookings/:id/cancel', cancelBooking);

export default router;
