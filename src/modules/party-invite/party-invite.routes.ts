import { Router } from 'express';
import { authenticate, ensureSameSociety } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParams, createPartyInviteSchema, addPartyGuestSchema, claimPartySlotSchema } from '../../schemas';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import {
  createPartyInvite,
  listPartyInvites,
  getPartyInvite,
  addPartyGuest,
  claimPartySlot,
  removePartyGuest,
  cancelPartyInvite,
} from './party-invite.controller';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../../config/redis';

const router = Router();

// Rate limiting for public claim endpoint (e.g., max 5 attempts per hour per IP)
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many attempts, please try again after an hour' },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
    prefix: 'rl:party-claim:',
  }),
});

// PUBLIC endpoint — guest self-service via share link (NO AUTH)
router.post('/:inviteCode/claim', claimLimiter, validate({ body: claimPartySlotSchema }), claimPartySlot);

// All other routes require resident auth
router.use(authenticate);
router.use(ensureSameSociety);

router.post('/', validate({ body: createPartyInviteSchema }), clearCacheAfter(['api:party-invites*']), createPartyInvite);
router.get('/', cache({ ttl: 120, keyPrefix: 'party-invites', varyBy: ['userId', 'societyId'] }), listPartyInvites);
router.get('/:id', validate({ params: idParams }), cache({ ttl: 120, keyPrefix: 'party-invites' }), getPartyInvite);
router.post('/:id/add-guest', validate({ params: idParams, body: addPartyGuestSchema }), clearCacheAfter(['api:party-invites*']), addPartyGuest);
router.delete('/:id/guests/:code', clearCacheAfter(['api:party-invites*']), removePartyGuest);
router.patch('/:id/cancel', validate({ params: idParams }), clearCacheAfter(['api:party-invites*']), cancelPartyInvite);

export default router;
