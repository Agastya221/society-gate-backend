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
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createEmergencySchema, resolveEmergencySchema, idParams } from '../../schemas';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes BEFORE parameterized routes
router.post('/', validate({ body: createEmergencySchema }), clearCacheAfter(['emergencies:*']), createEmergency);
router.get('/my', cache({ ttl: 30, keyPrefix: 'emergencies', varyBy: ['userId'] }), getMyEmergencies);

// Read-only: residents, admins, guards all see society emergencies
router.get('/active', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN', 'GUARD'), cache({ ttl: 10, keyPrefix: 'emergencies', varyBy: ['societyId'] }), getActiveEmergencies);
router.get('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN', 'GUARD'), cache({ ttl: 15, keyPrefix: 'emergencies', varyBy: ['societyId'] }), getEmergencies);

// Parameterized routes LAST
router.get('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN', 'GUARD'), validate({ params: idParams }), cache({ ttl: 30, keyPrefix: 'emergencies', varyBy: ['societyId'] }), getEmergencyById);

// Write operations restricted to admin + guard only
router.patch('/:id/respond', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), validate({ params: idParams }), clearCacheAfter(['emergencies:*']), respondToEmergency);
router.patch('/:id/resolve', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), validate({ params: idParams, body: resolveEmergencySchema }), clearCacheAfter(['emergencies:*']), resolveEmergency);
// false-alarm: auth is checked inside service (reporter or admin)
router.patch('/:id/false-alarm', validate({ params: idParams, body: resolveEmergencySchema }), clearCacheAfter(['emergencies:*']), markAsFalseAlarm);

export default router;
