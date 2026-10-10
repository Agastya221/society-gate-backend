import { Router } from 'express';
import {
  createAmenity,
  getAmenities,
  getAmenityById,
  updateAmenity,
  deleteAmenity,
  createBooking,
  getBookings,
  getMyBookings,
  approveBooking,
  cancelBooking,
  getSlots,
  bookSlot,
} from './amenity.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createAmenitySchema,
  updateAmenitySchema,
  createBookingSchema,
  bookSlotSchema,
  cancelBookingSchema,
} from './amenity.schemas';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Static routes first (must come before /:id to avoid param capture)
router.get('/', cache({ ttl: 300, keyPrefix: 'amenities', varyBy: ['societyId'] }), getAmenities);
router.get('/my-bookings', cache({ ttl: 60, keyPrefix: 'bookings', varyBy: ['userId'] }), getMyBookings);
router.get('/bookings', cache({ ttl: 60, keyPrefix: 'bookings', varyBy: ['societyId', 'userId'] }), getBookings);
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: createAmenitySchema }), clearCacheAfter(['amenities:*']), createAmenity);
router.post('/bookings', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ body: createBookingSchema }), clearCacheAfter(['bookings:*']), createBooking);
router.patch('/bookings/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['bookings:*']), approveBooking);
router.patch('/bookings/:id/cancel', validate({ body: cancelBookingSchema }), clearCacheAfter(['bookings:*']), cancelBooking);

// Param routes after static
router.get('/:id', cache({ ttl: 300, keyPrefix: 'amenities', varyBy: ['societyId'] }), getAmenityById);
router.get('/:id/slots', getSlots);
router.post('/:id/book', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ body: bookSlotSchema }), clearCacheAfter(['bookings:*']), bookSlot);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: updateAmenitySchema }), clearCacheAfter(['amenities:*']), updateAmenity);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['amenities:*']), deleteAmenity);

export default router;
