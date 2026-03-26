import { Router } from 'express';
import { authenticate, ensureSameSociety } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParams, createGuestInviteSchema } from '../../schemas';
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

router.post('/', validate({ body: createGuestInviteSchema }), createGuestInvite);
router.get('/', listGuestInvites);
router.get('/:id', validate({ params: idParams }), getGuestInvite);
router.patch('/:id/revoke', validate({ params: idParams }), revokeGuestInvite);
router.delete('/:id', validate({ params: idParams }), deleteGuestInvite);

export default router;
