import { Router } from 'express';
import { FamilyController } from './family.controller';
import { authenticateResidentApp } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();
const familyController = new FamilyController();

// All routes require resident authentication
router.use(authenticateResidentApp);

// Invite family member (Primary resident only)
router.post('/invite', clearCacheAfter(['api:family*']), familyController.inviteFamilyMember);

// Get all family members in user's flat
router.get('/', cache({ ttl: 300, keyPrefix: 'family', varyBy: ['userId', 'societyId'] }), familyController.getFamilyMembers);

// Remove family member (Primary resident only)
router.delete('/:memberId', clearCacheAfter(['api:family*']), familyController.removeFamilyMember);

// Update family role (Primary resident only)
router.patch('/:memberId/role', clearCacheAfter(['api:family*']), familyController.updateFamilyRole);

export default router;
