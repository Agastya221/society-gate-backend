import type { Response, Request } from 'express';
import { ReportsService } from './reports.service';

const reportsService = new ReportsService();

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { societyId } = req.query;
    const stats = await reportsService.getDashboardStats(societyId as string);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard stats',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch entry statistics',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch peak hours analysis',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch delivery patterns',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch complaint statistics',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch visitor frequency report',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch society health score',
    });
  }
};
