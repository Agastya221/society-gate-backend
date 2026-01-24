import { Router } from 'express';
import { EntryController } from './entry.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();
const entryController = new EntryController();

// All routes require authentication and society isolation
router.use(authenticate);
router.use(ensureSameSociety);

// Guard creates entry
router.post('/', authorize('GUARD'), entryController.createEntry);

// Resident/Admin approves or rejects
router.patch(
  '/:id/approve',
  authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'),
  entryController.approveEntry
);
router.patch(
  '/:id/reject',
  authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'),
  entryController.rejectEntry
);

// Guard does checkout
router.patch('/:id/checkout', authorize('GUARD'), entryController.checkoutEntry);

// Get entries (all roles)
router.get('/', entryController.getEntries);

// Get pending approvals (resident/admin only)
router.get(
  '/pending',
  authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'),
  entryController.getPendingApprovals
);

// Today's entries (guard dashboard)
router.get('/today', authorize('GUARD'), entryController.getTodayEntries);

export default router;