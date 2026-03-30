import { Router } from 'express';
import { createPoll, updatePoll, deletePoll, getPolls, getPollById, castVote } from './poll.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// All authenticated users can view polls
router.get('/', cache({ ttl: 60, keyPrefix: 'polls', varyBy: ['societyId', 'userId'] }), getPolls);
router.get('/:id', cache({ ttl: 60, keyPrefix: 'polls' }), getPollById);

// Residents can vote
router.post('/:id/vote', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['polls:*']), castVote);

// Admin only — create, update, delete
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['polls:*']), createPoll);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['polls:*']), updatePoll);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['polls:*']), deletePoll);

export default router;
