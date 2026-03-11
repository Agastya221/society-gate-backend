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
router.get('/active', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), cache({ ttl: 10, keyPrefix: 'emergencies', varyBy: ['societyId'] }), getActiveEmergencies);
router.get('/', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), cache({ ttl: 15, keyPrefix: 'emergencies', varyBy: ['societyId'] }), getEmergencies);

// Parameterized routes LAST
router.get('/:id', validate({ params: idParams }), cache({ ttl: 30, keyPrefix: 'emergencies' }), getEmergencyById);
router.patch('/:id/respond', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD'), validate({ params: idParams }), clearCacheAfter(['emergencies:*']), respondToEmergency);
router.patch('/:id/resolve', authorize('ADMIN', 'SUPER_ADMIN','GUARD'), validate({ params: idParams, body: resolveEmergencySchema }), clearCacheAfter(['emergencies:*']), resolveEmergency);
router.patch('/:id/false-alarm', authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams, body: resolveEmergencySchema }), clearCacheAfter(['emergencies:*']), markAsFalseAlarm);

export default router;
