import { Request, Response } from 'express';
import { SuperAdminService } from './superadmin.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const service = new SuperAdminService();

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export class SuperAdminController {
  overview = asyncHandler(async (_req: Request, res: Response) => {
    const result = await service.getOverview();
    res.json({ success: true, data: result });
  });

  listSocieties = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.listSocieties({
      ...req.query,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      isActive: parseBoolean(req.query.isActive),
    });
    res.json({ success: true, data: result });
  });

  getSociety = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.getSocietyById(String(req.params.id));
    res.json({ success: true, data: result });
  });

  updateSociety = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.updateSociety(req.user!, String(req.params.id), req.body);
    res.json({ success: true, message: 'Society updated successfully', data: result });
  });

  setSocietyStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.setSocietyStatus(req.user!, String(req.params.id), req.body);
    res.json({ success: true, message: 'Society status updated successfully', data: result });
  });

  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.listUsers({
      ...req.query,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      isActive: parseBoolean(req.query.isActive),
    });
    res.json({ success: true, data: result });
  });

  getUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.getUserById(String(req.params.id));
    res.json({ success: true, data: result });
  });

  setUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.setUserStatus(req.user!, String(req.params.id), req.body);
    res.json({ success: true, message: 'User status updated successfully', data: result });
  });

  listResidentOnboardingRequests = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.listOnboardingRequests({
      ...req.query,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  });

  listSocietyRegistrationRequests = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.listSocietyRegistrationRequests({
      ...req.query,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  });

  sales = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.getSales(req.query);
    res.json({ success: true, data: result });
  });

  collections = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.getCollections(req.query);
    res.json({ success: true, data: result });
  });

  activity = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.listActivity({
      ...req.query,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  });
}
