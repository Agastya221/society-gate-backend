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
router.get('/', authenticate, getVendors);
router.get('/by-category', authenticate, getVendorsByCategory);
router.get('/:id', authenticate, getVendorById);

// Residents can rate vendors
router.post('/:id/rate', authenticate, authorize('RESIDENT', 'ADMIN'), rateVendor);

// Admin routes
router.post('/', authenticate, authorize('ADMIN'), createVendor);
router.patch('/:id', authenticate, authorize('ADMIN'), updateVendor);
router.patch('/:id/verify', authenticate, authorize('ADMIN'), verifyVendor);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteVendor);

export default router;
