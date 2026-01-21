import { Router } from 'express';
import {
  createEntryRequest,
  getEntryRequests,
  getEntryRequestById,
  getEntryRequestPhoto,
  approveEntryRequest,
  rejectEntryRequest,
  getPendingCount,
} from './entry-request.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();

// All routes require authentication and society isolation
router.use(authenticate);
router.use(ensureSameSociety);

// Guard creates entry request
router.post('/', authorize('GUARD'), createEntryRequest);

// Get pending count for guard
router.get('/pending-count', authorize('GUARD'), getPendingCount);

// Get entry requests (all roles, filtered by role)
router.get('/', getEntryRequests);

// Get single entry request
router.get('/:id', getEntryRequestById);

// Get entry request photo (Residents/Admins only)
router.get('/:id/photo', authorize('RESIDENT', 'ADMIN'), getEntryRequestPhoto);

// Approve entry request (Resident only)
router.patch('/:id/approve', authorize('RESIDENT'), approveEntryRequest);

// Reject entry request (Resident only)
router.patch('/:id/reject', authorize('RESIDENT'), rejectEntryRequest);

export default router;
