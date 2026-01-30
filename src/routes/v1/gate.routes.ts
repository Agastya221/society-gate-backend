import { Router } from 'express';
import entryRequestRoutes from '../../modules/entry-request/entry-request.routes';
import preapprovalRoutes from '../../modules/preapproval/preapproval.routes';
import gatepassRoutes from '../../modules/gatepass/gatepass.routes';

const router = Router();

// All gate/entry management endpoints grouped together
// preapprovalRoutes now handles both /entries/* and /preapprovals/*
router.use('/', preapprovalRoutes);               // /api/v1/gate/entries/* and /api/v1/gate/preapprovals/*
router.use('/requests', entryRequestRoutes);      // /api/v1/gate/requests
router.use('/passes', gatepassRoutes);            // /api/v1/gate/passes

export default router;
