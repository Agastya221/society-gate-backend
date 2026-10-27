import type { Response, Request } from 'express';
import { prisma } from '../../utils/Client';
import { COMMON_AREAS, EmergencyService, redactForViewer } from './emergency.service';
import { getSocietyId } from '../../utils/scope';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { EmergencyFilters, EmergencyStatus, EmergencyType } from '../../types';

const emergencyService = new EmergencyService();

export const createEmergency = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const actingAs = res.locals.authAppType === 'GUARD_APP' && req.user!.role === 'GUARD' ? 'GUARD' : undefined;
    const emergency = await emergencyService.createEmergency(req.body, userId, getSocietyId(req), actingAs);

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

const viewerOf = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

/** The places a person can pick when raising an emergency: the society's towers, and the common areas. */
export const getEmergencyPlaces = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const blocks = await prisma.block.findMany({
      where: { societyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ success: true, data: { blocks, commonAreas: COMMON_AREAS } });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getEmergencies = async (req: Request, res: Response) => {
  try {
    const filters: EmergencyFilters = {
      societyId: getSocietyId(req),
      status: req.query.status as EmergencyStatus | undefined,
      type: req.query.type as EmergencyType | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await emergencyService.getEmergencies(filters);
    const viewer = viewerOf(req);

    res.status(200).json({
      success: true,
      data: { ...result, emergencies: result.emergencies.map((e) => redactForViewer(e, viewer)) },
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
    const emergency = await emergencyService.getEmergencyById(String(id), getSocietyId(req));

    res.status(200).json({
      success: true,
      data: redactForViewer(emergency as Record<string, any>, viewerOf(req)),
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
    const emergency = await emergencyService.respondToEmergency(String(id), userId, getSocietyId(req));

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
    const emergency = await emergencyService.resolveEmergency(String(id), notes, userId, getSocietyId(req));

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
    const userId = req.user!.id;
    const emergency = await emergencyService.markAsFalseAlarm(String(id), notes, userId, getSocietyId(req));

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
    const societyId = getSocietyId(req);
    const emergencies = await emergencyService.getActiveEmergencies(societyId);
    const viewer = viewerOf(req);

    res.status(200).json({
      success: true,
      data: emergencies.map((e) => redactForViewer(e, viewer)),
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
