"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.togglePinNotice = exports.deleteNotice = exports.updateNotice = exports.getNoticeById = exports.getNotices = exports.createNotice = void 0;
const notice_service_1 = require("./notice.service");
const noticeService = new notice_service_1.NoticeService();
const createNotice = async (req, res) => {
    try {
        const userId = req.user.id;
        const notice = await noticeService.createNotice(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Notice created successfully',
            data: notice,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create notice',
        });
    }
};
exports.createNotice = createNotice;
const getNotices = async (req, res) => {
    try {
        const filters = req.query;
        const result = await noticeService.getNotices(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch notices',
        });
    }
};
exports.getNotices = getNotices;
const getNoticeById = async (req, res) => {
    try {
        const { id } = req.params;
        const notice = await noticeService.getNoticeById(id);
        res.status(200).json({
            success: true,
            data: notice,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch notice',
        });
    }
};
exports.getNoticeById = getNoticeById;
const updateNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const notice = await noticeService.updateNotice(id, req.body, userId);
        res.status(200).json({
            success: true,
            message: 'Notice updated successfully',
            data: notice,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update notice',
        });
    }
};
exports.updateNotice = updateNotice;
const deleteNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const result = await noticeService.deleteNotice(id, userId);
        res.status(200).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete notice',
        });
    }
};
exports.deleteNotice = deleteNotice;
const togglePinNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const notice = await noticeService.togglePinNotice(id);
        res.status(200).json({
            success: true,
            message: 'Notice pin status updated',
            data: notice,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to toggle pin status',
        });
    }
};
exports.togglePinNotice = togglePinNotice;
