import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import { SocietyOnboardingService } from './society-onboarding.service';

const service = new SocietyOnboardingService();

export class SocietyOnboardingController {
  createLead = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.createLead(req.body, req.user!);
    res.status(201).json({ success: true, message: 'Society lead created', data: result });
  });

  inviteAdmin = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.inviteAdmin(String(req.params.societyId), req.body, req.user!);
    res.json({ success: true, message: 'Society admin invited for web onboarding', data: result });
  });

  getStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.getStatus(String(req.params.societyId), req.user!);
    res.json({ success: true, data: result });
  });

  updateBasicDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.updateBasicDetails(String(req.params.societyId), req.body, req.user!);
    res.json({ success: true, message: 'Basic details updated', data: result });
  });

  updateFinancialDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.updateFinancialDetails(String(req.params.societyId), req.body, req.user!);
    res.json({ success: true, message: 'Financial details updated', data: result });
  });

  getDocumentUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.getDocumentUploadUrl(String(req.params.societyId), req.body, req.user!);
    res.json({ success: true, message: 'Upload URL generated', data: result });
  });

  addDocument = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.addDocument(String(req.params.societyId), req.body, req.user!);
    res.status(201).json({ success: true, message: 'Society onboarding document saved', data: result });
  });

  submitVerification = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.submitVerification(String(req.params.societyId), req.user!);
    res.json({ success: true, message: 'Society submitted for verification', data: result });
  });

  approveVerification = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.approveVerification(
      String(req.params.societyId),
      req.user!.id,
      req.body?.notes,
    );
    res.json({ success: true, message: 'Society verification approved', data: result });
  });

  rejectVerification = asyncHandler(async (req: Request, res: Response) => {
    const reason = req.body?.reason;
    if (!reason) throw new AppError('Rejection reason is required', 400);

    const result = await service.rejectVerification(
      String(req.params.societyId),
      req.user!.id,
      reason,
    );
    res.json({ success: true, message: 'Society verification rejected', data: result });
  });

  getImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="society-import-template.csv"');
    res.status(200).send(service.getImportTemplateCsv());
  });

  validateImport = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.validateImport(String(req.params.societyId), req.body, req.user!);
    res.status(201).json({
      success: result.status === 'VALIDATED',
      message: result.status === 'VALIDATED' ? 'Import file validated' : 'Import file has validation errors',
      data: result,
    });
  });

  commitImport = asyncHandler(async (req: Request, res: Response) => {
    const batchId = req.body?.batchId;
    if (!batchId) throw new AppError('batchId is required', 400);

    const result = await service.commitImport(String(req.params.societyId), batchId, req.user!);
    res.json({ success: true, message: 'Society import committed', data: result });
  });

  updateRules = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.updateRules(String(req.params.societyId), req.body, req.user!);
    res.json({ success: true, message: 'Society rules updated', data: result });
  });

  updateBranding = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.updateBranding(String(req.params.societyId), req.body, req.user!);
    res.json({ success: true, message: 'Society branding updated', data: result });
  });

  configureGates = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.configureGates(String(req.params.societyId), req.body, req.user!);
    res.status(201).json({ success: true, message: 'Gate configuration saved', data: result });
  });

  createGuards = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.createGuards(String(req.params.societyId), req.body, req.user!);
    res.status(201).json({ success: true, message: 'Guard accounts configured', data: result });
  });

  activateSociety = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.activateSociety(String(req.params.societyId), req.user!);
    res.json({ success: true, message: 'Society activated for resident app access', data: result });
  });

  sendResidentInvites = asyncHandler(async (req: Request, res: Response) => {
    const result = await service.sendResidentInvites(String(req.params.societyId), req.user!);
    res.json({ success: true, message: 'Resident invitations queued', data: result });
  });
}
