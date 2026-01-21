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
router.post('/', authenticate, authorize('RESIDENT', 'ADMIN'), createGatePass);
router.get('/', authenticate, getGatePasses);

// Guard routes - specific /scan path before /:id
router.post('/scan', authenticate, authorize('GUARD'), scanGatePass);

// Parameterized routes come LAST
router.get('/:id', authenticate, getGatePassById);
router.get('/:id/qr', authenticate, getGatePassQR);
router.patch('/:id/approve', authenticate, authorize('ADMIN'), approveGatePass);
router.patch('/:id/reject', authenticate, authorize('ADMIN'), rejectGatePass);
router.delete('/:id', authenticate, cancelGatePass);

export default router;