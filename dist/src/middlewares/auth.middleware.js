"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSameSociety = exports.authorize = exports.authenticateGuardApp = exports.authenticateResidentApp = exports.authenticate = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Client_1 = require("../utils/Client");
const ResponseHandler_1 = require("../utils/ResponseHandler");
// ============================================
// JWT TOKEN GENERATION
// ============================================
const generateToken = (userId, role, societyId, flatId, appType) => {
    const expiresIn = appType === 'RESIDENT_APP' ? '30d' : '7d';
    return jsonwebtoken_1.default.sign({
        userId,
        role,
        societyId,
        flatId,
        appType,
    }, process.env.JWT_SECRET, { expiresIn });
};
exports.generateToken = generateToken;
// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            throw new ResponseHandler_1.AppError('No token provided. Please login.', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await Client_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { flat: true, society: true },
        });
        if (!user || !user.isActive) {
            throw new ResponseHandler_1.AppError('User not found or inactive', 401);
        }
        if (!user.society?.isActive) {
            throw new ResponseHandler_1.AppError('Society is inactive', 403);
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new ResponseHandler_1.AppError('Invalid token', 401));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new ResponseHandler_1.AppError('Token expired. Please login again.', 401));
        }
        next(error);
    }
};
exports.authenticate = authenticate;
// ============================================
// APP-SPECIFIC AUTHENTICATION
// ============================================
const authenticateResidentApp = async (req, res, next) => {
    await (0, exports.authenticate)(req, res, () => {
        if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'RESIDENT') {
            return next(new ResponseHandler_1.AppError('Access denied. This is for residents only.', 403));
        }
        // Ensure resident has a flat assigned
        if (req.user && req.user.role === 'RESIDENT' && !req.user.flatId) {
            return next(new ResponseHandler_1.AppError('User must have a flat assigned', 403));
        }
        next();
    });
};
exports.authenticateResidentApp = authenticateResidentApp;
const authenticateGuardApp = async (req, res, next) => {
    await (0, exports.authenticate)(req, res, () => {
        if (req.user && req.user.role !== 'GUARD') {
            return next(new ResponseHandler_1.AppError('Access denied. This is for guards only.', 403));
        }
        // Ensure guard has a society assigned
        if (req.user && !req.user.societyId) {
            return next(new ResponseHandler_1.AppError('Guard must be assigned to a society', 403));
        }
        next();
    });
};
exports.authenticateGuardApp = authenticateGuardApp;
// ============================================
// AUTHORIZATION MIDDLEWARE (Role-based)
// ============================================
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ResponseHandler_1.AppError('User not authenticated', 401));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ResponseHandler_1.AppError(`Access denied. Required role: ${allowedRoles.join(' or ')}`, 403));
        }
        next();
    };
};
exports.authorize = authorize;
// ============================================
// SOCIETY ISOLATION MIDDLEWARE
// ============================================
const ensureSameSociety = async (req, res, next) => {
    try {
        const userSocietyId = req.user?.societyId;
        // Ensure user has a society
        if (!userSocietyId) {
            throw new ResponseHandler_1.AppError('User must be assigned to a society', 403);
        }
        const resourceSocietyId = req.body.societyId || req.params.societyId || req.query.societyId;
        if (resourceSocietyId && resourceSocietyId !== userSocietyId) {
            throw new ResponseHandler_1.AppError('Access denied. You can only access resources in your society.', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.ensureSameSociety = ensureSameSociety;
