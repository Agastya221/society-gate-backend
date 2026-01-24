import { Router } from 'express';
import {
  createGatePass,
  approveGatePass,
  rejectGatePass,
  scanGatePass,
  getGatePasses,
  getGatePassById,
  getGatePassQR,
  cancelGatePass,
} from './gatepass.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// ============================================
// IMPORTANT: Specific routes before parameterized routes
// ============================================

// Resident/Admin routes - specific paths first
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), createGatePass);
router.get('/', getGatePasses);

// Guard routes - specific /scan path before /:id
router.post('/scan', authorize('GUARD'), scanGatePass);

// Parameterized routes come LAST
router.get('/:id', getGatePassById);
router.get('/:id/qr', getGatePassQR);
router.patch('/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), approveGatePass);
router.patch('/:id/reject', authorize('ADMIN', 'SUPER_ADMIN'), rejectGatePass);
router.delete('/:id', cancelGatePass);

export default router;