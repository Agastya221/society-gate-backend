import { Request, Response } from 'express';
import { SocietyService } from './society.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const societyService = new SocietyService();

export class SocietyController {
  createSociety = asyncHandler(async (req: Request, res: Response) => {
    const society = await societyService.createSociety(req.body);

    res.status(201).json({
      success: true,
      message: 'Society created successfully',
      data: society,
    });
  });

  createBlock = asyncHandler(async (req: Request, res: Response) => {
    const block = await societyService.createBlock(String(req.params.id), req.body, req.user!);

    res.status(201).json({
      success: true,
      message: 'Block created successfully',
      data: block,
    });
  });

  createFlat = asyncHandler(async (req: Request, res: Response) => {
    const flat = await societyService.createFlat(String(req.params.id), req.body, req.user!);

    res.status(201).json({
      success: true,
      message: 'Flat created successfully',
      data: flat,
    });
  });

  updateFlat = asyncHandler(async (req: Request, res: Response) => {
    const flat = await societyService.updateFlat(String(req.params.id), String(req.params.flatId), req.body, req.user!);

    res.json({
      success: true,
      message: 'Flat updated successfully',
      data: flat,
    });
  });

  deactivateFlat = asyncHandler(async (req: Request, res: Response) => {
    const flat = await societyService.deactivateFlat(String(req.params.id), String(req.params.flatId), req.user!);

    res.json({
      success: true,
      message: 'Flat deactivated successfully',
      data: flat,
    });
  });

  getSocieties = asyncHandler(async (req: Request, res: Response) => {
    const result = await societyService.getSocieties(req.query);

    res.json({
      success: true,
      data: result,
    });
  });

  getSociety = asyncHandler(async (req: Request, res: Response) => {
    const society = await societyService.getSocietyById(String(req.params.id));

    res.json({
      success: true,
      data: society,
    });
  });

  updateSociety = asyncHandler(async (req: Request, res: Response) => {
    const society = await societyService.updateSociety(String(req.params.id), req.body);

    res.json({
      success: true,
      message: 'Society updated successfully',
      data: society,
    });
  });

  markPaymentPaid = asyncHandler(async (req: Request, res: Response) => {
    const society = await societyService.markPaymentPaid(String(req.params.id));

    res.json({
      success: true,
      message: 'Payment marked as paid',
      data: society,
    });
  });

  getSocietyStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await societyService.getSocietyStats(String(req.params.id));

    res.json({
      success: true,
      data: stats,
    });
  });
}
