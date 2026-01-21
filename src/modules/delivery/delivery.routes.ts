import { Router } from 'express';
import { DeliveryController } from './delivery.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();
const deliveryController = new DeliveryController();

router.use(authenticate);
router.use(ensureSameSociety);
router.use(authorize('RESIDENT', 'ADMIN'));

// Expected deliveries
router.post('/expected', deliveryController.createExpectedDelivery);
router.get('/expected', deliveryController.getExpectedDeliveries);

// Auto-approve rules
router.post('/auto-approve', deliveryController.createAutoApproveRule);
router.get('/auto-approve', deliveryController.getAutoApproveRules);
router.patch('/auto-approve/:id', deliveryController.toggleAutoApproveRule);
router.delete('/auto-approve/:id', deliveryController.deleteAutoApproveRule);

// Popular companies list
router.get('/companies', deliveryController.getPopularCompanies);

export default router;