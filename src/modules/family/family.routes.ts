import { Router } from 'express';
import { FamilyController } from './family.controller';
import { authenticateResidentApp } from '../../middlewares/auth.middleware';

const router = Router();
const familyController = new FamilyController();

// All routes require resident authentication
router.use(authenticateResidentApp);

// Invite family member (Primary resident only)
router.post('/invite', familyController.inviteFamilyMember);

// Get all family members in user's flat
router.get('/', familyController.getFamilyMembers);

// Remove family member (Primary resident only)
router.delete('/:memberId', familyController.removeFamilyMember);

// Update family role (Primary resident only)
router.patch('/:memberId/role', familyController.updateFamilyRole);

export default router;
