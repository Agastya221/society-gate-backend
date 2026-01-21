"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocietyHealthScore = exports.getVisitorFrequencyReport = exports.getComplaintStatistics = exports.getDeliveryPatterns = exports.getPeakHoursAnalysis = exports.getEntryStatistics = exports.getDashboardStats = void 0;
const reports_service_1 = require("./reports.service");
const reportsService = new reports_service_1.ReportsService();
const getDashboardStats = async (req, res) => {
    try {
        const { societyId } = req.query;
        const stats = await reportsService.getDashboardStats(societyId);
        res.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch dashboard stats',
        });
    }
};
exports.getDashboardStats = getDashboardStats;
const getEntryStatistics = async (req, res) => {
    try {
        const { societyId, days = 7 } = req.query;
        const stats = await reportsService.getEntryStatistics(societyId, Number(days));
        res.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch entry statistics',
        });
    }
};
exports.getEntryStatistics = getEntryStatistics;
const getPeakHoursAnalysis = async (req, res) => {
    try {
        const { societyId, days = 30 } = req.query;
        const analysis = await reportsService.getPeakHoursAnalysis(societyId, Number(days));
        res.status(200).json({
            success: true,
            data: analysis,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch peak hours analysis',
        });
    }
};
exports.getPeakHoursAnalysis = getPeakHoursAnalysis;
const getDeliveryPatterns = async (req, res) => {
    try {
        const { societyId, days = 30 } = req.query;
        const patterns = await reportsService.getDeliveryPatterns(societyId, Number(days));
        res.status(200).json({
            success: true,
            data: patterns,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch delivery patterns',
        });
    }
};
exports.getDeliveryPatterns = getDeliveryPatterns;
const getComplaintStatistics = async (req, res) => {
    try {
        const { societyId } = req.query;
        const stats = await reportsService.getComplaintStatistics(societyId);
        res.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch complaint statistics',
        });
    }
};
exports.getComplaintStatistics = getComplaintStatistics;
const getVisitorFrequencyReport = async (req, res) => {
    try {
        const { societyId } = req.query;
        const report = await reportsService.getVisitorFrequencyReport(societyId);
        res.status(200).json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch visitor frequency report',
        });
    }
};
exports.getVisitorFrequencyReport = getVisitorFrequencyReport;
const getSocietyHealthScore = async (req, res) => {
    try {
        const { societyId } = req.query;
        const healthScore = await reportsService.getSocietyHealthScore(societyId);
        res.status(200).json({
            success: true,
            data: healthScore,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch society health score',
        });
    }
};
exports.getSocietyHealthScore = getSocietyHealthScore;
