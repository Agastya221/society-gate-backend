import { Router } from 'express';
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  verifyVendor,
  deleteVendor,
  rateVendor,
  getVendorsByCategory,
} from './vendor.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// Cached GET routes
router.get('/', cache({ ttl: 300, keyPrefix: 'vendors', varyBy: ['societyId'] }), getVendors);
router.get('/by-category', cache({ ttl: 300, keyPrefix: 'vendors', varyBy: ['societyId'] }), getVendorsByCategory);
router.get('/:id', cache({ ttl: 300, keyPrefix: 'vendors' }), getVendorById);

// Routes that invalidate cache
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), createVendor);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), updateVendor);
router.patch('/:id/verify', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), verifyVendor);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), deleteVendor);
router.post('/:id/rate', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), rateVendor);

export default router;
