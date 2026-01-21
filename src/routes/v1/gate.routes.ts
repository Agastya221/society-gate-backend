import { Router } from 'express';
import entryRoutes from '../../modules/entry/entry.routes';
import entryRequestRoutes from '../../modules/entry-request/entry-request.routes';
import preapprovalRoutes from '../../modules/preapproval/preapproval.routes';
import gatepassRoutes from '../../modules/gatepass/gatepass.routes';

const router = Router();

// All gate/entry management endpoints grouped together
router.use('/entries', entryRoutes);           // /api/v1/gate/entries
router.use('/requests', entryRequestRoutes);    // /api/v1/gate/requests
router.use('/preapprovals', preapprovalRoutes); // /api/v1/gate/preapprovals
router.use('/passes', gatepassRoutes);          // /api/v1/gate/passes

export default router;
