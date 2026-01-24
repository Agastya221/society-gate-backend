import { Router } from 'express';
import {
  createEmergency,
  getEmergencies,
  getMyEmergencies,
  getEmergencyById,
  respondToEmergency,
  resolveEmergency,
  markAsFalseAlarm,
  getActiveEmergencies,
} from './emergency.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// All authenticated users can create emergencies
router.post('/', createEmergency);

// Resident route - get their own emergencies (must be before /:id)
router.get('/my', getMyEmergencies);

// Admin and Guard routes
router.get('/', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), getEmergencies);
router.get('/active', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), getActiveEmergencies);
router.get('/:id', getEmergencyById);
router.patch('/:id/respond', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), respondToEmergency);
router.patch('/:id/resolve', authorize('ADMIN', 'SUPER_ADMIN'), resolveEmergency);
router.patch('/:id/false-alarm', authorize('ADMIN', 'SUPER_ADMIN'), markAsFalseAlarm);

export default router;
