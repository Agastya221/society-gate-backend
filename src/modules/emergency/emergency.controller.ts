import type { Response, Request } from 'express';
import { EmergencyService } from './emergency.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { EmergencyFilters, EmergencyStatus, EmergencyType } from '../../types';

const emergencyService = new EmergencyService();

export const createEmergency = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const emergency = await emergencyService.createEmergency(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Emergency alert created. Help is on the way!',
      data: emergency,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getEmergencies = async (req: Request, res: Response) => {
  try {
    const filters: EmergencyFilters = {
      societyId: req.user!.societyId!,
      status: req.query.status as EmergencyStatus | undefined,
      type: req.query.type as EmergencyType | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await emergencyService.getEmergencies(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getMyEmergencies = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await emergencyService.getMyEmergencies(userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getEmergencyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const emergency = await emergencyService.getEmergencyById(String(id));

    res.status(200).json({
      success: true,
      data: emergency,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const respondToEmergency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const emergency = await emergencyService.respondToEmergency(String(id), userId);

    res.status(200).json({
      success: true,
      message: 'Emergency response recorded',
      data: emergency,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const resolveEmergency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user!.id;
    const emergency = await emergencyService.resolveEmergency(String(id), notes, userId);

    res.status(200).json({
      success: true,
      message: 'Emergency resolved',
      data: emergency,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const markAsFalseAlarm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const emergency = await emergencyService.markAsFalseAlarm(String(id), notes);

    res.status(200).json({
      success: true,
      message: 'Marked as false alarm',
      data: emergency,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getActiveEmergencies = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const emergencies = await emergencyService.getActiveEmergencies(societyId);

    res.status(200).json({
      success: true,
      data: emergencies,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
