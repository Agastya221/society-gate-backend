import type { Response, Request } from 'express';
import { VendorService } from './vendor.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { VendorFilters, VendorCategory } from '../../types';

const vendorService = new VendorService();

export const createVendor = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const vendor = await vendorService.createVendor(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: vendor,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getVendors = async (req: Request, res: Response) => {
  try {
    const filters: VendorFilters = {
      societyId: req.user!.societyId!,
      category: req.query.category as VendorCategory | undefined,
      isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await vendorService.getVendors(filters);

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

export const getVendorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const vendor = await vendorService.getVendorById(String(id));

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const updateVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const vendor = await vendorService.updateVendor(String(id), req.body);

    res.status(200).json({
      success: true,
      message: 'Vendor updated successfully',
      data: vendor,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const verifyVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const vendor = await vendorService.verifyVendor(String(id));

    res.status(200).json({
      success: true,
      message: vendor.isVerified ? 'Vendor verified' : 'Vendor unverified',
      data: vendor,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const deleteVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await vendorService.deleteVendor(String(id));

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const rateVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const vendor = await vendorService.updateVendorRating(String(id), rating);

    res.status(200).json({
      success: true,
      message: 'Vendor rated successfully',
      data: vendor,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getVendorsByCategory = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const vendors = await vendorService.getVendorsByCategory(societyId);

    res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
