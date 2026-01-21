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
router.post('/', authenticate, authorize('RESIDENT', 'ADMIN'), createComplaint);
router.get('/', authenticate, getComplaints);
router.get('/:id', authenticate, getComplaintById);
router.delete('/:id', authenticate, deleteComplaint);

// Admin routes
router.patch('/:id/status', authenticate, authorize('ADMIN'), updateComplaintStatus);
router.patch('/:id/assign', authenticate, authorize('ADMIN'), assignComplaint);
router.patch('/:id/resolve', authenticate, authorize('ADMIN'), resolveComplaint);

export default router;
