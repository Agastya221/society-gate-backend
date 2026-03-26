import { Router } from 'express';
import { authenticate, ensureSameSociety } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParams, createPartyInviteSchema, addPartyGuestSchema, claimPartySlotSchema } from '../../schemas';
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

const router = Router();

// Rate limiting for public claim endpoint (e.g., max 5 attempts per hour per IP)
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many attempts, please try again after an hour' },
});

// PUBLIC endpoint — guest self-service via share link (NO AUTH)
router.post('/:inviteCode/claim', claimLimiter, validate({ body: claimPartySlotSchema }), claimPartySlot);

// All other routes require resident auth
router.use(authenticate);
router.use(ensureSameSociety);

router.post('/', validate({ body: createPartyInviteSchema }), createPartyInvite);
router.get('/', listPartyInvites);
router.get('/:id', validate({ params: idParams }), getPartyInvite);
router.post('/:id/add-guest', validate({ params: idParams, body: addPartyGuestSchema }), addPartyGuest);
router.delete('/:id/guests/:code', removePartyGuest);
router.patch('/:id/cancel', validate({ params: idParams }), cancelPartyInvite);

export default router;
