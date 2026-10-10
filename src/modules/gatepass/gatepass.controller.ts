import type { Response, Request } from 'express';
import { GatePassService, type GatePassCaller } from './gatepass.service';
import { getSocietyId } from '../../utils/scope';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { GatePassFilters, GatePassType, GatePassStatus } from '../../types';

const gatePassService = new GatePassService();

const callerOf = (req: Request): GatePassCaller => ({
  id: req.user!.id,
  role: req.user!.role,
  flatId: req.user!.flatId ?? null,
  societyId: getSocietyId(req),
});

export const createGatePass = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const gatePass = await gatePassService.createGatePass(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Gate pass created successfully',
      data: gatePass,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const approveGatePass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const gatePass = await gatePassService.approveGatePass(String(id), userId, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Gate pass approved successfully',
      data: gatePass,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const rejectGatePass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    const gatePass = await gatePassService.rejectGatePass(String(id), reason, userId, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Gate pass rejected successfully',
      data: gatePass,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const scanGatePass = async (req: Request, res: Response) => {
  try {
    const { qrToken } = req.body;
    const userId = req.user!.id;

    const gatePass = await gatePassService.scanGatePass(qrToken, userId, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Gate pass scanned successfully',
      data: gatePass,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getGatePasses = async (req: Request, res: Response) => {
  try {
    const caller = callerOf(req);
    const filters: GatePassFilters = {
      societyId: caller.societyId,
      flatId: req.query.flatId as string | undefined,
      type: req.query.type as GatePassType | undefined,
      status: req.query.status as GatePassStatus | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await gatePassService.getGatePasses(filters, caller);

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

export const getGatePassById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gatePass = await gatePassService.getGatePassById(String(id), callerOf(req));

    res.status(200).json({
      success: true,
      data: gatePass,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getGatePassQR = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gatePassData = await gatePassService.getGatePassQR(String(id), callerOf(req));

    // Return only the token — frontend renders the QR code
    // Backend generates QR image on-demand only for emails/WhatsApp/PDF
    res.status(200).json({
      success: true,
      data: gatePassData,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const cancelGatePass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const gatePass = await gatePassService.cancelGatePass(String(id), userId, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Gate pass cancelled successfully',
      data: gatePass,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
