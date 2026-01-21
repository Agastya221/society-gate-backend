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
router.post('/', authenticate, createEmergency);

// Resident route - get their own emergencies (must be before /:id)
router.get('/my', authenticate, getMyEmergencies);

// Admin and Guard routes
router.get('/', authenticate, authorize('ADMIN', 'GUARD'), getEmergencies);
router.get('/active', authenticate, authorize('ADMIN', 'GUARD'), getActiveEmergencies);
router.get('/:id', authenticate, getEmergencyById);
router.patch('/:id/respond', authenticate, authorize('ADMIN', 'GUARD'), respondToEmergency);
router.patch('/:id/resolve', authenticate, authorize('ADMIN'), resolveEmergency);
router.patch('/:id/false-alarm', authenticate, authorize('ADMIN'), markAsFalseAlarm);

export default router;
