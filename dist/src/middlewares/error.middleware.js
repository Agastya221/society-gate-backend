"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const ResponseHandler_1 = require("../utils/ResponseHandler");
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof ResponseHandler_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }
    // Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
        return res.status(400).json({
            success: false,
            message: 'Database error occurred',
        });
    }
    // Default error
    res.status(500).json({
        success: false,
        message: 'Internal server error',
    });
};
exports.errorHandler = errorHandler;
