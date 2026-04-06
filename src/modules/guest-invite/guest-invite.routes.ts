import { Router } from 'express';
import { authenticate, ensureSameSociety } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParams, createGuestInviteSchema } from '../../schemas';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import {
  createGuestInvite,
  listGuestInvites,
  getGuestInvite,
  revokeGuestInvite,
  deleteGuestInvite,
} from './guest-invite.controller';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

router.post('/', validate({ body: createGuestInviteSchema }), clearCacheAfter(['api:guest-invites*']), createGuestInvite);
router.get('/', cache({ ttl: 120, keyPrefix: 'guest-invites', varyBy: ['userId', 'societyId'] }), listGuestInvites);
router.get('/:id', validate({ params: idParams }), cache({ ttl: 120, keyPrefix: 'guest-invites' }), getGuestInvite);
router.patch('/:id/revoke', validate({ params: idParams }), clearCacheAfter(['api:guest-invites*']), revokeGuestInvite);
router.delete('/:id', validate({ params: idParams }), clearCacheAfter(['api:guest-invites*']), deleteGuestInvite);

export default router;
