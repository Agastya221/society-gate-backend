import type { Request, Response } from 'express';
import { PartyInviteService } from './party-invite.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';

const service = new PartyInviteService();

export const createPartyInvite = async (req: Request, res: Response) => {
  try {
    const invite = await service.create(req.user!.id, {
      ...req.body,
      validFrom: new Date(req.body.validFrom),
      validUntil: new Date(req.body.validUntil),
    });
    res.status(201).json({ success: true, data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const listPartyInvites = async (req: Request, res: Response) => {
  try {
    const invites = await service.list(req.user!.id);
    res.json({ success: true, data: invites });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getPartyInvite = async (req: Request, res: Response) => {
  try {
    const invite = await service.getById(String(req.params.id), req.user!.id);
    res.json({ success: true, data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const addPartyGuest = async (req: Request, res: Response) => {
  try {
    const slot = await service.addGuest(String(req.params.id), req.user!.id, req.body.name, req.body.phone);
    res.json({ success: true, data: slot });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const claimPartySlot = async (req: Request, res: Response) => {
  try {
    const result = await service.claimSlot(String(req.params.inviteCode), req.body.phone);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const removePartyGuest = async (req: Request, res: Response) => {
  try {
    const result = await service.removeGuest(String(req.params.id), req.user!.id, String(req.params.code));
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const cancelPartyInvite = async (req: Request, res: Response) => {
  try {
    const invite = await service.cancel(String(req.params.id), req.user!.id);
    res.json({ success: true, data: invite });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
