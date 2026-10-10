import type { Request, Response } from 'express';
import { VehicleService } from './vehicle.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import { getSocietyId, clampPagination } from '../../utils/scope';
import {
  registerVehicleSchema,
  updateVehicleSchema,
  approveVehicleSchema,
  listVehiclesQuerySchema,
  zodErrorBody,
} from './vehicle.schemas';

const vehicleService = new VehicleService();

export const registerVehicle = async (req: Request, res: Response) => {
  try {
    // Only known keys reach Prisma (no status/parkingSlot/stickerNumber/etc. from the client)
    const parsed = registerVehicleSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
    const vehicle = await vehicleService.registerVehicle(
      parsed.data,
      req.user!.id,
      req.user!.flatId ?? null,
      getSocietyId(req),
      req.user!.role,
    );
    res.status(201).json({
      success: true,
      message: vehicle.status === 'PENDING'
        ? 'Vehicle registered. It will be active once the society admin verifies it.'
        : 'Vehicle registered successfully.',
      data: vehicle,
    });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getMyVehicles = async (req: Request, res: Response) => {
  try {
    const vehicles = await vehicleService.getMyVehicles(req.user!.id);
    res.status(200).json({ success: true, data: vehicles });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    // Owners may only edit descriptive fields; status/slot/sticker are admin-controlled
    const parsed = updateVehicleSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
    const vehicle = await vehicleService.updateVehicle(
      String(req.params.id), parsed.data, req.user!.id, getSocietyId(req),
    );
    res.status(200).json({ success: true, message: 'Vehicle updated', data: vehicle });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const result = await vehicleService.deleteVehicle(String(req.params.id), req.user!.id, getSocietyId(req));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getAllVehicles = async (req: Request, res: Response) => {
  try {
    const parsed = listVehiclesQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
    const { page, limit } = clampPagination(parsed.data.page, parsed.data.limit, 20);
    const result = await vehicleService.getAllVehicles({
      societyId: getSocietyId(req),
      status: parsed.data.status,
      vehicleType: parsed.data.vehicleType,
      flatId: parsed.data.flatId,
      page,
      limit,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const approveVehicle = async (req: Request, res: Response) => {
  try {
    const parsed = approveVehicleSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "status must be 'ACTIVE' or 'REJECTED'" });
    }
    // SUPER_ADMIN without a society context may act platform-wide; everyone else is society-scoped.
    const societyId = req.user!.role === 'SUPER_ADMIN'
      ? (req.societyId ?? req.user!.societyId ?? null)
      : getSocietyId(req);
    const vehicle = await vehicleService.approveVehicle(String(req.params.id), parsed.data, societyId);
    res.status(200).json({ success: true, message: `Vehicle ${vehicle.status.toLowerCase()}`, data: vehicle });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const searchVehicle = async (req: Request, res: Response) => {
  try {
    // Accept vehicleNumber, q, or plateNumber for frontend compatibility
    const rawQuery = req.query.vehicleNumber ?? req.query.q ?? req.query.plateNumber;
    if (typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return res.status(400).json({ success: false, message: 'Provide vehicleNumber, q, or plateNumber as query param' });
    }
    const result = await vehicleService.searchVehicle(rawQuery.trim().slice(0, 20), getSocietyId(req));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
