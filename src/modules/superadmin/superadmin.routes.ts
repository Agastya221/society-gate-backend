import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { clearCacheAfter } from '../../middlewares/cache.middleware';
import { SuperAdminController } from './superadmin.controller';

const router = Router();
const controller = new SuperAdminController();

router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/overview', controller.overview);

router.get('/societies', controller.listSocieties);
router.get('/societies/:id', controller.getSociety);
router.patch('/societies/:id', clearCacheAfter(['society:*', 'superadmin:*']), controller.updateSociety);
router.patch('/societies/:id/status', clearCacheAfter(['society:*', 'superadmin:*']), controller.setSocietyStatus);

router.get('/users', controller.listUsers);
router.get('/users/:id', controller.getUser);
router.patch('/users/:id/status', clearCacheAfter(['user:*', 'superadmin:*']), controller.setUserStatus);

router.get('/onboarding/resident-requests', controller.listResidentOnboardingRequests);
router.get('/onboarding/society-requests', controller.listSocietyRegistrationRequests);

router.get('/sales', controller.sales);
router.get('/collections', controller.collections);
router.get('/activity', controller.activity);

export default router;
