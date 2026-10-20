import type { Request, Response } from 'express';
import { GuestInviteService } from './guest-invite.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { GuestInviteStatus, GuestInviteType } from '../../../prisma/generated/prisma/client';

const service = new GuestInviteService();

export const createGuestInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // Explicit allow-list (never spread req.body into the DTO)
    const { type, visitorName, visitorPhone, validFrom, validUntil, allowedDays, timeFrom, timeUntil, isPrivate, note, guestCount } = req.body;
    const invite = await service.create(userId, {
      type,
      visitorName,
      visitorPhone,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      allowedDays,
      timeFrom,
      timeUntil,
      isPrivate,
      note,
      guestCount,
    });

    res.status(201).json({ success: true, data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const listGuestInvites = async (req: Request, res: Response) => {
  try {
    const status = (Array.isArray(req.query.status) ? req.query.status[0] : req.query.status) as GuestInviteStatus | undefined;
    const type = (Array.isArray(req.query.type) ? req.query.type[0] : req.query.type) as GuestInviteType | undefined;
    const invites = await service.list(req.user!.id, status, type);
    res.json({ success: true, data: invites });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getGuestInvite = async (req: Request, res: Response) => {
  try {
    const invite = await service.getById(String(req.params.id), req.user!.id);
    res.json({ success: true, data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const revokeGuestInvite = async (req: Request, res: Response) => {
  try {
    const invite = await service.revoke(String(req.params.id), req.user!.id);
    res.json({ success: true, data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deleteGuestInvite = async (req: Request, res: Response) => {
  try {
    const result = await service.delete(String(req.params.id), req.user!.id);
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
