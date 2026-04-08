import { Request, Response } from 'express';
import { FamilyService } from './family.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const familyService = new FamilyService();

export class FamilyController {
  // Add family member (Primary resident only)
  addFamilyMember = asyncHandler(async (req: Request, res: Response) => {
    const { phone, name, familyRole } = req.body;
    const primaryResidentId = req.user!.id;

    const result = await familyService.addFamilyMember({
      phone,
      name,
      familyRole,
      primaryResidentId,
    });

    const message = result.isNew
      ? 'Family member added. They will be linked when they log in with this number.'
      : 'Existing user linked to your flat as a family member.';

    res.status(201).json({
      success: true,
      message,
      data: result.member,
    });
  });

  // Get all family members
  getFamilyMembers = asyncHandler(async (req: Request, res: Response) => {
    const familyMembers = await familyService.getFamilyMembers(req.user!.id);

    res.status(200).json({
      success: true,
      data: familyMembers,
    });
  });

  // Remove family member
  removeFamilyMember = asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const result = await familyService.removeFamilyMember(String(memberId), req.user!.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  });

  // Update family role
  updateFamilyRole = asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const { familyRole } = req.body;

    const updated = await familyService.updateFamilyRole(String(memberId), familyRole, req.user!.id);

    res.status(200).json({
      success: true,
      message: 'Family role updated successfully',
      data: updated,
    });
  });
}
