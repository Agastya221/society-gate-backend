import type { Response, Request } from 'express';
import { ReportsService } from './reports.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';

const reportsService = new ReportsService();

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { societyId } = req.query;
    const stats = await reportsService.getDashboardStats(societyId as string);

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
    const { societyId, days = 7 } = req.query;
    const stats = await reportsService.getEntryStatistics(societyId as string, Number(days));

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
    const { societyId, days = 30 } = req.query;
    const analysis = await reportsService.getPeakHoursAnalysis(societyId as string, Number(days));

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
    const { societyId, days = 30 } = req.query;
    const patterns = await reportsService.getDeliveryPatterns(societyId as string, Number(days));

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
    const { societyId } = req.query;
    const stats = await reportsService.getComplaintStatistics(societyId as string);

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
    const { societyId } = req.query;
    const report = await reportsService.getVisitorFrequencyReport(societyId as string);

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
    const { societyId } = req.query;
    const healthScore = await reportsService.getSocietyHealthScore(societyId as string);

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
