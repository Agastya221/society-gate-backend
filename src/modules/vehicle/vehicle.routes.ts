import { Router } from 'express';
import {
  registerVehicle, getMyVehicles, updateVehicle, deleteVehicle,
  getAllVehicles, approveVehicle, searchVehicle,
} from './vehicle.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Resident routes
router.get('/my', cache({ ttl: 120, keyPrefix: 'vehicles', varyBy: ['userId'] }), getMyVehicles);
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vehicles:*']), registerVehicle);
router.patch('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vehicles:*']), updateVehicle);
router.delete('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vehicles:*']), deleteVehicle);

// Admin routes
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), cache({ ttl: 120, keyPrefix: 'vehicles', varyBy: ['societyId'] }), getAllVehicles);
router.patch('/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['vehicles:*']), approveVehicle);

// Search (guard + admin + resident)
router.get('/search', cache({ ttl: 30, keyPrefix: 'vehicles' }), searchVehicle);

export default router;
