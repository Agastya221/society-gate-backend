"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendorsByCategory = exports.rateVendor = exports.deleteVendor = exports.verifyVendor = exports.updateVendor = exports.getVendorById = exports.getVendors = exports.createVendor = void 0;
const vendor_service_1 = require("./vendor.service");
const vendorService = new vendor_service_1.VendorService();
const createVendor = async (req, res) => {
    try {
        const userId = req.user.id;
        const vendor = await vendorService.createVendor(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Vendor created successfully',
            data: vendor,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create vendor',
        });
    }
};
exports.createVendor = createVendor;
const getVendors = async (req, res) => {
    try {
        const filters = req.query;
        const result = await vendorService.getVendors(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch vendors',
        });
    }
};
exports.getVendors = getVendors;
const getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await vendorService.getVendorById(id);
        res.status(200).json({
            success: true,
            data: vendor,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch vendor',
        });
    }
};
exports.getVendorById = getVendorById;
const updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await vendorService.updateVendor(id, req.body);
        res.status(200).json({
            success: true,
            message: 'Vendor updated successfully',
            data: vendor,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update vendor',
        });
    }
};
exports.updateVendor = updateVendor;
const verifyVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await vendorService.verifyVendor(id);
        res.status(200).json({
            success: true,
            message: vendor.isVerified ? 'Vendor verified' : 'Vendor unverified',
            data: vendor,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to verify vendor',
        });
    }
};
exports.verifyVendor = verifyVendor;
const deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await vendorService.deleteVendor(id);
        res.status(200).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete vendor',
        });
    }
};
exports.deleteVendor = deleteVendor;
const rateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating } = req.body;
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5',
            });
        }
        const vendor = await vendorService.updateVendorRating(id, rating);
        res.status(200).json({
            success: true,
            message: 'Vendor rated successfully',
            data: vendor,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to rate vendor',
        });
    }
};
exports.rateVendor = rateVendor;
const getVendorsByCategory = async (req, res) => {
    try {
        const { societyId } = req.query;
        const vendors = await vendorService.getVendorsByCategory(societyId);
        res.status(200).json({
            success: true,
            data: vendors,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch vendors by category',
        });
    }
};
exports.getVendorsByCategory = getVendorsByCategory;
