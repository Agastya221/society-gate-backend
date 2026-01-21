import { Request, Response } from 'express';
import { FamilyService } from './family.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const familyService = new FamilyService();

export class FamilyController {
  // Invite family member
  inviteFamilyMember = asyncHandler(async (req: Request, res: Response) => {
    const { phone, name, email, familyRole } = req.body;
    const primaryResidentId = req.user!.id;

    const familyMember = await familyService.inviteFamilyMember({
      phone,
      name,
      email,
      familyRole,
      primaryResidentId,
    });

    res.status(201).json({
      success: true,
      message: 'Family member invited successfully. They need to verify OTP to activate account.',
      data: familyMember,
    });
  });

  // Get all family members
  getFamilyMembers = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const familyMembers = await familyService.getFamilyMembers(userId);

    res.status(200).json({
      success: true,
      data: familyMembers,
    });
  });

  // Remove family member
  removeFamilyMember = asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const primaryResidentId = req.user!.id;

    const result = await familyService.removeFamilyMember(memberId, primaryResidentId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  });

  // Update family role
  updateFamilyRole = asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const { familyRole } = req.body;
    const primaryResidentId = req.user!.id;

    const updatedMember = await familyService.updateFamilyRole(
      memberId,
      familyRole,
      primaryResidentId
    );

    res.status(200).json({
      success: true,
      message: 'Family role updated successfully',
      data: updatedMember,
    });
  });
}
