import type { Response, Request } from 'express';
import { VendorService } from './vendor.service';

const vendorService = new VendorService();

export const createVendor = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const vendor = await vendorService.createVendor(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: vendor,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create vendor',
    });
  }
};

export const getVendors = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await vendorService.getVendors(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch vendors',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch vendor',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update vendor',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to verify vendor',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to delete vendor',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to rate vendor',
    });
  }
};

export const getVendorsByCategory = async (req: Request, res: Response) => {
  try {
    const { societyId } = req.query;
    const vendors = await vendorService.getVendorsByCategory(societyId as string);

    res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch vendors by category',
    });
  }
};
