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
router.get('/', getNotices);
router.get('/:id', getNoticeById);

// Admin only routes
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), createNotice);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), updateNotice);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), deleteNotice);
router.patch('/:id/toggle-pin', authorize('ADMIN', 'SUPER_ADMIN'), togglePinNotice);

export default router;
