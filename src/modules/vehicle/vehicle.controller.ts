import type { Request, Response } from 'express';
import { VehicleService } from './vehicle.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { VehicleStatus } from '../../types';

const vehicleService = new VehicleService();

export const registerVehicle = async (req: Request, res: Response) => {
  try {
    const vehicle = await vehicleService.registerVehicle(
      req.body,
      req.user!.id,
      req.user!.flatId!,
      req.user!.societyId!
    );
    res.status(201).json({ success: true, message: 'Vehicle registered successfully.', data: vehicle });
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
    const vehicle = await vehicleService.updateVehicle(String(req.params.id), req.body, req.user!.id);
    res.status(200).json({ success: true, message: 'Vehicle updated', data: vehicle });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const result = await vehicleService.deleteVehicle(String(req.params.id), req.user!.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getAllVehicles = async (req: Request, res: Response) => {
  try {
    const result = await vehicleService.getAllVehicles({
      societyId: req.user!.societyId!,
      status: req.query.status as VehicleStatus | undefined,
      vehicleType: req.query.vehicleType as string | undefined,
      flatId: req.query.flatId as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const approveVehicle = async (req: Request, res: Response) => {
  try {
    const vehicle = await vehicleService.approveVehicle(String(req.params.id), req.body);
    res.status(200).json({ success: true, message: `Vehicle ${vehicle.status.toLowerCase()}`, data: vehicle });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const searchVehicle = async (req: Request, res: Response) => {
  try {
    // Accept vehicleNumber, q, or plateNumber for frontend compatibility
    const rawQuery = (req.query.vehicleNumber ?? req.query.q ?? req.query.plateNumber) as string | undefined;
    if (!rawQuery) {
      return res.status(400).json({ success: false, message: 'Provide vehicleNumber, q, or plateNumber as query param' });
    }
    const result = await vehicleService.searchVehicle(rawQuery, req.user!.societyId!);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
