"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComplaint = exports.resolveComplaint = exports.assignComplaint = exports.updateComplaintStatus = exports.getComplaintById = exports.getComplaints = exports.createComplaint = void 0;
const complaint_service_1 = require("./complaint.service");
const complaintService = new complaint_service_1.ComplaintService();
const createComplaint = async (req, res) => {
    try {
        const userId = req.user.id;
        const complaint = await complaintService.createComplaint(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Complaint created successfully',
            data: complaint,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create complaint',
        });
    }
};
exports.createComplaint = createComplaint;
const getComplaints = async (req, res) => {
    try {
        const filters = req.query;
        const result = await complaintService.getComplaints(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch complaints',
        });
    }
};
exports.getComplaints = getComplaints;
const getComplaintById = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await complaintService.getComplaintById(id);
        res.status(200).json({
            success: true,
            data: complaint,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch complaint',
        });
    }
};
exports.getComplaintById = getComplaintById;
const updateComplaintStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const complaint = await complaintService.updateComplaintStatus(id, status);
        res.status(200).json({
            success: true,
            message: 'Complaint status updated',
            data: complaint,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update complaint status',
        });
    }
};
exports.updateComplaintStatus = updateComplaintStatus;
const assignComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedToId } = req.body;
        const complaint = await complaintService.assignComplaint(id, assignedToId);
        res.status(200).json({
            success: true,
            message: 'Complaint assigned successfully',
            data: complaint,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to assign complaint',
        });
    }
};
exports.assignComplaint = assignComplaint;
const resolveComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution } = req.body;
        const userId = req.user.id;
        const complaint = await complaintService.resolveComplaint(id, resolution, userId);
        res.status(200).json({
            success: true,
            message: 'Complaint resolved successfully',
            data: complaint,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to resolve complaint',
        });
    }
};
exports.resolveComplaint = resolveComplaint;
const deleteComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const result = await complaintService.deleteComplaint(id, userId);
        res.status(200).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete complaint',
        });
    }
};
exports.deleteComplaint = deleteComplaint;
