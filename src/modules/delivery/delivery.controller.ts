import { Request, Response } from 'express';
import { DeliveryService } from './delivery.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const deliveryService = new DeliveryService();

export class DeliveryController {
  // Create expected delivery
  createExpectedDelivery = asyncHandler(async (req: Request, res: Response) => {
    const delivery = await deliveryService.createExpectedDelivery(
      req.body,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      message: 'Expected delivery added. It will be auto-approved when arrives.',
      data: delivery,
    });
  });

  // Create auto-approve rule
  createAutoApproveRule = asyncHandler(async (req: Request, res: Response) => {
    const rule = await deliveryService.createAutoApproveRule(
      req.body,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      message: 'Auto-approve rule created',
      data: rule,
    });
  });

  // Get auto-approve rules
  getAutoApproveRules = asyncHandler(async (req: Request, res: Response) => {
    const rules = await deliveryService.getAutoApproveRules(req.user!.flatId!);

    res.json({
      success: true,
      data: rules,
    });
  });

  // Toggle rule
  toggleAutoApproveRule = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    const rule = await deliveryService.toggleAutoApproveRule(
      req.params.id,
      isActive
    );

    res.json({
      success: true,
      message: isActive ? 'Rule activated' : 'Rule deactivated',
      data: rule,
    });
  });

  // Delete rule
  deleteAutoApproveRule = asyncHandler(async (req: Request, res: Response) => {
    await deliveryService.deleteAutoApproveRule(req.params.id);

    res.json({
      success: true,
      message: 'Auto-approve rule deleted',
    });
  });

  // Get expected deliveries
  getExpectedDeliveries = asyncHandler(async (req: Request, res: Response) => {
    const deliveries = await deliveryService.getExpectedDeliveries(
      req.user!.flatId!
    );

    res.json({
      success: true,
      data: deliveries,
    });
  });

  // Get popular companies (for dropdown)
  getPopularCompanies = asyncHandler(async (req: Request, res: Response) => {
    const companies = deliveryService.getPopularCompanies();

    res.json({
      success: true,
      data: companies,
    });
  });
}