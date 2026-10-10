import type { Response, Request } from 'express';
import { ReportsService } from './reports.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import { getSocietyId } from '../../utils/scope';

const reportsService = new ReportsService();

// The society comes from the caller (ensureSameSociety sets req.societyId):
// ADMIN is pinned to their own society; only SUPER_ADMIN may pick one via ?societyId=.
const MAX_REPORT_DAYS = 365;
const clampDays = (value: unknown, fallback: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_REPORT_DAYS) : fallback;
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const stats = await reportsService.getDashboardStats(societyId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getEntryStatistics = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const days = clampDays(req.query.days, 7);
    const stats = await reportsService.getEntryStatistics(societyId, days);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getPeakHoursAnalysis = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const days = clampDays(req.query.days, 30);
    const analysis = await reportsService.getPeakHoursAnalysis(societyId, days);

    res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getDeliveryPatterns = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const days = clampDays(req.query.days, 30);
    const patterns = await reportsService.getDeliveryPatterns(societyId, days);

    res.status(200).json({
      success: true,
      data: patterns,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getComplaintStatistics = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const stats = await reportsService.getComplaintStatistics(societyId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getVisitorFrequencyReport = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const report = await reportsService.getVisitorFrequencyReport(societyId);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getSocietyHealthScore = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const healthScore = await reportsService.getSocietyHealthScore(societyId);

    res.status(200).json({
      success: true,
      data: healthScore,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
