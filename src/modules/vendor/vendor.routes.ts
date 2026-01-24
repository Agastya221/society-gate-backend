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

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// All authenticated users can view vendors
router.get('/', getVendors);
router.get('/by-category', getVendorsByCategory);
router.get('/:id', getVendorById);

// Residents can rate vendors
router.post('/:id/rate', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), rateVendor);

// Admin routes
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), createVendor);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), updateVendor);
router.patch('/:id/verify', authorize('ADMIN', 'SUPER_ADMIN'), verifyVendor);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), deleteVendor);

export default router;
