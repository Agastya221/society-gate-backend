import { Router } from 'express';
import {
  createNotice,
  getNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  togglePinNotice,
} from './notice.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// Public routes (all authenticated users)
router.get('/', authenticate, getNotices);
router.get('/:id', authenticate, getNoticeById);

// Admin only routes
router.post('/', authenticate, authorize('ADMIN'), createNotice);
router.patch('/:id', authenticate, authorize('ADMIN'), updateNotice);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteNotice);
router.patch('/:id/toggle-pin', authenticate, authorize('ADMIN'), togglePinNotice);

export default router;
