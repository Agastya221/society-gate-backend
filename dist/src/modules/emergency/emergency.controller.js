"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveEmergencies = exports.markAsFalseAlarm = exports.resolveEmergency = exports.respondToEmergency = exports.getEmergencyById = exports.getMyEmergencies = exports.getEmergencies = exports.createEmergency = void 0;
const emergency_service_1 = require("./emergency.service");
const emergencyService = new emergency_service_1.EmergencyService();
const createEmergency = async (req, res) => {
    try {
        const userId = req.user.id;
        const emergency = await emergencyService.createEmergency(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Emergency alert created. Help is on the way!',
            data: emergency,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create emergency alert',
        });
    }
};
exports.createEmergency = createEmergency;
const getEmergencies = async (req, res) => {
    try {
        const filters = req.query;
        const result = await emergencyService.getEmergencies(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch emergencies',
        });
    }
};
exports.getEmergencies = getEmergencies;
const getMyEmergencies = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await emergencyService.getMyEmergencies(userId);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch your emergencies',
        });
    }
};
exports.getMyEmergencies = getMyEmergencies;
const getEmergencyById = async (req, res) => {
    try {
        const { id } = req.params;
        const emergency = await emergencyService.getEmergencyById(id);
        res.status(200).json({
            success: true,
            data: emergency,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch emergency',
        });
    }
};
exports.getEmergencyById = getEmergencyById;
const respondToEmergency = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const emergency = await emergencyService.respondToEmergency(id, userId);
        res.status(200).json({
            success: true,
            message: 'Emergency response recorded',
            data: emergency,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to respond to emergency',
        });
    }
};
exports.respondToEmergency = respondToEmergency;
const resolveEmergency = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = req.user.id;
        const emergency = await emergencyService.resolveEmergency(id, notes, userId);
        res.status(200).json({
            success: true,
            message: 'Emergency resolved',
            data: emergency,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to resolve emergency',
        });
    }
};
exports.resolveEmergency = resolveEmergency;
const markAsFalseAlarm = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const emergency = await emergencyService.markAsFalseAlarm(id, notes);
        res.status(200).json({
            success: true,
            message: 'Marked as false alarm',
            data: emergency,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to mark as false alarm',
        });
    }
};
exports.markAsFalseAlarm = markAsFalseAlarm;
const getActiveEmergencies = async (req, res) => {
    try {
        const { societyId } = req.query;
        const emergencies = await emergencyService.getActiveEmergencies(societyId);
        res.status(200).json({
            success: true,
            data: emergencies,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch active emergencies',
        });
    }
};
exports.getActiveEmergencies = getActiveEmergencies;
