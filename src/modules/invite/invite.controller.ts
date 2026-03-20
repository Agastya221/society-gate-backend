import type { Request, Response } from 'express';
import { InviteService } from './invite.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { InviteStatus } from '../../../prisma/generated/prisma/client';

const inviteService = new InviteService();

export const createInvitePass = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { flatId, ...dto } = req.body;

    const invite = await inviteService.createInvitePass(flatId, userId, {
      ...dto,
      validFrom: new Date(dto.validFrom),
      validUntil: new Date(dto.validUntil),
    });

    res.status(201).json({
      success: true,
      message: 'Invite pass created',
      data: invite,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getMyInvites = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const flatId = req.user!.flatId;
    const { status } = req.query;

    if (!flatId) {
      return res.status(400).json({ success: false, message: 'No flat associated with your account' });
    }

    const invites = await inviteService.getMyInvites(userId, flatId as string, (Array.isArray(status) ? status[0] : status) as InviteStatus | undefined);

    res.status(200).json({ success: true, data: invites });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getInviteById = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const invite = await inviteService.getInviteById(id, userId);

    res.status(200).json({ success: true, data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const cancelInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const invite = await inviteService.cancelInvite(id, userId);

    res.status(200).json({ success: true, message: 'Invite cancelled', data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
