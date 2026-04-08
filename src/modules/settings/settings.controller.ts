import { Request, Response } from 'express';
import { SettingsService } from './settings.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const settingsService = new SettingsService();

export class SettingsController {
  getResidentSettingsSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await settingsService.getResidentSettingsSummary(req.user!.id);

    res.json({
      success: true,
      data: summary,
    });
  });
}
