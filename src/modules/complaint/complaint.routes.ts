import { Router } from 'express';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  assignComplaint,
  resolveComplaint,
  deleteComplaint,
} from './complaint.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();

// Apply authentication and society isolation globally ONCE
router.use(authenticate);
router.use(ensureSameSociety);

// Resident routes - NO NEED to add authenticate again
router.post('/', authorize('RESIDENT', 'ADMIN'), createComplaint);
router.get('/', getComplaints);  // ✅ No duplicate authenticate
router.get('/:id', getComplaintById);
router.delete('/:id', deleteComplaint);

// Admin routes
router.patch('/:id/status', authorize('ADMIN'), updateComplaintStatus);
router.patch('/:id/assign', authorize('ADMIN'), assignComplaint);
router.patch('/:id/resolve', authorize('ADMIN'), resolveComplaint);

export default router;