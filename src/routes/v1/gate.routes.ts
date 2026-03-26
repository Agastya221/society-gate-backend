import { Router } from 'express';
import entryRequestRoutes from '../../modules/entry-request/entry-request.routes';
import gatepassRoutes from '../../modules/gatepass/gatepass.routes';
import guestInviteRoutes from '../../modules/guest-invite/guest-invite.routes';
import partyInviteRoutes from '../../modules/party-invite/party-invite.routes';

const router = Router();

router.use('/requests', entryRequestRoutes);      // /api/v1/gate/requests
router.use('/passes', gatepassRoutes);             // /api/v1/gate/passes

// New invite system
router.use('/invites/guest', guestInviteRoutes);   // /api/v1/gate/invites/guest
router.use('/invites/party', partyInviteRoutes);   // /api/v1/gate/invites/party

export default router;
