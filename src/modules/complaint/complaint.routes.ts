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

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// Resident routes
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), createComplaint);
router.get('/', getComplaints);
router.get('/:id', getComplaintById);
router.delete('/:id', deleteComplaint);

// Admin routes
router.patch('/:id/status', authorize('ADMIN', 'SUPER_ADMIN'), updateComplaintStatus);
router.patch('/:id/assign', authorize('ADMIN', 'SUPER_ADMIN'), assignComplaint);
router.patch('/:id/resolve', authorize('ADMIN', 'SUPER_ADMIN'), resolveComplaint);

export default router;
