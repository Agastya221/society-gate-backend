import { Router } from 'express';
import { FamilyController } from './family.controller';
import { authenticateResidentApp } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { addFamilyMemberSchema, updateFamilyRoleSchema } from '../../schemas';

const router = Router();
const familyController = new FamilyController();

router.use(authenticateResidentApp);

// Add family member (name + phone, optional role)
// /invite kept as a backwards-compatible alias
router.post('/add', validate({ body: addFamilyMemberSchema }), clearCacheAfter(['api:family*']), familyController.addFamilyMember);
router.post('/invite', validate({ body: addFamilyMemberSchema }), clearCacheAfter(['api:family*']), familyController.addFamilyMember);

// Get all family members in user's flat
router.get('/', cache({ ttl: 300, keyPrefix: 'family', varyBy: ['userId', 'societyId'] }), familyController.getFamilyMembers);

// Remove family member
router.delete('/:memberId', clearCacheAfter(['api:family*']), familyController.removeFamilyMember);

// Update family role
router.patch('/:memberId/role', validate({ body: updateFamilyRoleSchema }), clearCacheAfter(['api:family*']), familyController.updateFamilyRole);

export default router;
