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
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// Cached GET routes - Amenities
router.get('/amenities', cache({ ttl: 300, keyPrefix: 'amenities', varyBy: ['societyId'] }), getAmenities);
router.get('/amenities/:id', cache({ ttl: 300, keyPrefix: 'amenities' }), getAmenityById);
router.get('/bookings', cache({ ttl: 60, keyPrefix: 'bookings', varyBy: ['societyId', 'userId'] }), getBookings);

// Routes that invalidate cache - Amenities
router.post('/amenities', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['amenities:*']), createAmenity);
router.patch('/amenities/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['amenities:*']), updateAmenity);
router.delete('/amenities/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['amenities:*']), deleteAmenity);

// Routes that invalidate cache - Bookings
router.post('/bookings', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['bookings:*']), createBooking);
router.patch('/bookings/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['bookings:*']), approveBooking);
router.patch('/bookings/:id/cancel', clearCacheAfter(['bookings:*']), cancelBooking);

export default router;
