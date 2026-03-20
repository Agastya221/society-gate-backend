import { Router } from 'express';
import entryRequestRoutes from '../../modules/entry-request/entry-request.routes';
import gatepassRoutes from '../../modules/gatepass/gatepass.routes';
import inviteRoutes from '../../modules/invite/invite.routes';

const router = Router();

router.use('/requests', entryRequestRoutes);  // /api/v1/gate/requests
router.use('/passes', gatepassRoutes);        // /api/v1/gate/passes
router.use('/invites', inviteRoutes);         // /api/v1/gate/invites

export default router;
