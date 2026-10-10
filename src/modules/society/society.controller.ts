import { Request, Response } from 'express';
import { SocietyService } from './society.service';
import { asyncHandler } from '../../utils/ResponseHandler';
import {
  adminUpdateSocietySchema,
  superAdminUpdateSocietySchema,
  createSocietySchema,
  createBlockSchema,
  createFlatSchema,
  updateFlatSchema,
  listSocietiesQuerySchema,
  parseOrThrow,
  assertOwnedLogoKey,
} from './society.schemas';

const societyService = new SocietyService();

export class SocietyController {
  createSociety = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createSocietySchema, req.body);
    // The society doesn't exist yet, so only the caller's own uploads qualify.
    if (input.logoKey) assertOwnedLogoKey(input.logoKey, req.user!.id, req.user!.id);
    const society = await societyService.createSociety(input);

    res.status(201).json({
      success: true,
      message: 'Society created successfully',
      data: society,
    });
  });

  createBlock = asyncHandler(async (req: Request, res: Response) => {
    const block = await societyService.createBlock(String(req.params.id), parseOrThrow(createBlockSchema, req.body), req.user!);

    res.status(201).json({
      success: true,
      message: 'Block created successfully',
      data: block,
    });
  });

  createFlat = asyncHandler(async (req: Request, res: Response) => {
    const flat = await societyService.createFlat(String(req.params.id), parseOrThrow(createFlatSchema, req.body), req.user!);

    res.status(201).json({
      success: true,
      message: 'Flat created successfully',
      data: flat,
    });
  });

  updateFlat = asyncHandler(async (req: Request, res: Response) => {
    const flat = await societyService.updateFlat(
      String(req.params.id),
      String(req.params.flatId),
      parseOrThrow(updateFlatSchema, req.body),
      req.user!
    );

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
    const query = parseOrThrow(listSocietiesQuerySchema, req.query);
    const result = await societyService.getSocieties({
      city: query.city || undefined,
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
      page: query.page,
      limit: query.limit,
    });

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
    // Strict allow-list: ADMIN gets profile/contact fields only; billing, status
    // and relations are SUPER_ADMIN-only (or never editable).
    const data =
      req.user!.role === 'SUPER_ADMIN'
        ? parseOrThrow(superAdminUpdateSocietySchema, req.body)
        : parseOrThrow(adminUpdateSocietySchema, req.body);
    if ('logoKey' in data) assertOwnedLogoKey(data.logoKey, String(req.params.id), req.user!.id);
    const society = await societyService.updateSociety(String(req.params.id), data);

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
