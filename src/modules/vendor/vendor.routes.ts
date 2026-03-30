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
  likeVendor,
  getCategorySummary,
} from './vendor.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes MUST come before /:id
router.get('/by-category', cache({ ttl: 300, keyPrefix: 'vendors', varyBy: ['societyId'] }), getVendorsByCategory);
router.get('/categories', cache({ ttl: 300, keyPrefix: 'vendors', varyBy: ['societyId'] }), getCategorySummary);

// List + detail
router.get('/', cache({ ttl: 300, keyPrefix: 'vendors', varyBy: ['societyId'] }), getVendors);
router.get('/:id', cache({ ttl: 300, keyPrefix: 'vendors' }), getVendorById);

// Residents can add contacts; admins can manage all
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), createVendor);
router.patch('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), updateVendor);
router.patch('/:id/verify', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), verifyVendor);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), deleteVendor);
router.post('/:id/rate', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), rateVendor);
router.post('/:id/like', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vendors:*']), likeVendor);

export default router;
