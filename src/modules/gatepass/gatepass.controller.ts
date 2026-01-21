import type { Response, Request } from 'express';
import { GatePassService } from './gatepass.service';
import { generateQRImage } from '../../utils/QrGenerate';

const gatePassService = new GatePassService();

export const createGatePass = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const gatePass = await gatePassService.createGatePass(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Gate pass created successfully',
      data: gatePass,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create gate pass',
    });
  }
};

export const approveGatePass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const gatePass = await gatePassService.approveGatePass(id, userId);

    res.status(200).json({
      success: true,
      message: 'Gate pass approved successfully',
      data: gatePass,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to approve gate pass',
    });
  }
};

export const rejectGatePass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user.id;

    const gatePass = await gatePassService.rejectGatePass(id, reason, userId);

    res.status(200).json({
      success: true,
      message: 'Gate pass rejected successfully',
      data: gatePass,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to reject gate pass',
    });
  }
};

export const scanGatePass = async (req: Request, res: Response) => {
  try {
    const { qrToken } = req.body;
    const userId = (req as any).user.id;

    const gatePass = await gatePassService.scanGatePass(qrToken, userId);

    res.status(200).json({
      success: true,
      message: 'Gate pass scanned successfully',
      data: gatePass,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to scan gate pass',
    });
  }
};

export const getGatePasses = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await gatePassService.getGatePasses(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch gate passes',
    });
  }
};

export const getGatePassById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gatePass = await gatePassService.getGatePassById(id);

    res.status(200).json({
      success: true,
      data: gatePass,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch gate pass',
    });
  }
};

export const getGatePassQR = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gatePassData = await gatePassService.getGatePassQR(id);

    // Generate QR code image
    const qrCodeImage = await generateQRImage(gatePassData.qrToken);

    res.status(200).json({
      success: true,
      data: {
        ...gatePassData,
        qrCodeImage, // Base64 encoded image
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate QR code',
    });
  }
};

export const cancelGatePass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const gatePass = await gatePassService.cancelGatePass(id, userId);

    res.status(200).json({
      success: true,
      message: 'Gate pass cancelled successfully',
      data: gatePass,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to cancel gate pass',
    });
  }
};
