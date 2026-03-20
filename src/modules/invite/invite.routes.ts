import { Router } from 'express';
import { authenticate, ensureSameSociety } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParams } from '../../schemas';
import { createInvitePassSchema } from '../../schemas';
import {
  createInvitePass,
  getMyInvites,
  getInviteById,
  cancelInvite,
} from './invite.controller';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

router.post('/', validate({ body: createInvitePassSchema }), createInvitePass);
router.get('/', getMyInvites);
router.get('/:id', validate({ params: idParams }), getInviteById);
router.patch('/:id/cancel', validate({ params: idParams }), cancelInvite);

export default router;
