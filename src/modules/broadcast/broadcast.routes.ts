import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { z } from 'zod';
import { sendBroadcast, getBroadcastHistory } from './broadcast.controller';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

const broadcastSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required').max(2000),
  isEmergency: z.boolean().optional().default(false),
  target: z.string().optional().default('ALL'), // 'ALL' or a blockId
});

// POST /admin/broadcast
router.post(
  '/',
  validate({ body: broadcastSchema }),
  clearCacheAfter(['api:notices*']),
  sendBroadcast,
);

// GET /admin/broadcast — History of past broadcasts
router.get(
  '/',
  cache({ ttl: 120, keyPrefix: 'broadcast', varyBy: ['societyId'] }),
  getBroadcastHistory,
);

export default router;
