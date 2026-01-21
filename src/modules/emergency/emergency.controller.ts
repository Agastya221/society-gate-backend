import type { Response, Request } from 'express';
import { EmergencyService } from './emergency.service';

const emergencyService = new EmergencyService();

export const createEmergency = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const emergency = await emergencyService.createEmergency(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Emergency alert created. Help is on the way!',
      data: emergency,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create emergency alert',
    });
  }
};

export const getEmergencies = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await emergencyService.getEmergencies(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch emergencies',
    });
  }
};

export const getMyEmergencies = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const result = await emergencyService.getMyEmergencies(userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch your emergencies',
    });
  }
};

export const getEmergencyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const emergency = await emergencyService.getEmergencyById(id);

    res.status(200).json({
      success: true,
      data: emergency,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch emergency',
    });
  }
};

export const respondToEmergency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const emergency = await emergencyService.respondToEmergency(id, userId);

    res.status(200).json({
      success: true,
      message: 'Emergency response recorded',
      data: emergency,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to respond to emergency',
    });
  }
};

export const resolveEmergency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = (req as any).user.id;
    const emergency = await emergencyService.resolveEmergency(id, notes, userId);

    res.status(200).json({
      success: true,
      message: 'Emergency resolved',
      data: emergency,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to resolve emergency',
    });
  }
};

export const markAsFalseAlarm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const emergency = await emergencyService.markAsFalseAlarm(id, notes);

    res.status(200).json({
      success: true,
      message: 'Marked as false alarm',
      data: emergency,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to mark as false alarm',
    });
  }
};

export const getActiveEmergencies = async (req: Request, res: Response) => {
  try {
    const { societyId } = req.query;
    const emergencies = await emergencyService.getActiveEmergencies(societyId as string);

    res.status(200).json({
      success: true,
      data: emergencies,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch active emergencies',
    });
  }
};
