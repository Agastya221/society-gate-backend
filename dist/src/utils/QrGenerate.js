"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQRBuffer = exports.generateQRImage = exports.verifyQRToken = exports.generateQRToken = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// ============================================
// GENERATE QR TOKEN (JWT)
// ============================================
const generateQRToken = (payload, expiresIn = '10y') => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
    }
    const options = { expiresIn };
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, options);
};
exports.generateQRToken = generateQRToken;
// ============================================
// VERIFY QR TOKEN
// ============================================
const verifyQRToken = (token) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
    }
    try {
        return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('QR code expired');
        }
        throw new Error('Invalid QR code');
    }
};
exports.verifyQRToken = verifyQRToken;
// ============================================
// GENERATE QR CODE IMAGE (Base64)
// ============================================
const generateQRImage = async (data, options) => {
    try {
        const qrOptions = {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: options?.width || 300,
            margin: options?.margin || 2,
            color: {
                dark: options?.color?.dark || '#000000',
                light: options?.color?.light || '#FFFFFF',
            },
        };
        // Generate QR as base64 data URL
        const qrCodeDataURL = await qrcode_1.default.toDataURL(data, qrOptions);
        return qrCodeDataURL; // Returns: "data:image/png;base64,iVBORw0KG..."
    }
    catch (error) {
        throw new Error('Failed to generate QR code image');
    }
};
exports.generateQRImage = generateQRImage;
// ============================================
// GENERATE QR CODE BUFFER (For file download)
// ============================================
const generateQRBuffer = async (data) => {
    try {
        return await qrcode_1.default.toBuffer(data, {
            errorCorrectionLevel: 'M',
            width: 300,
            margin: 2,
        });
    }
    catch (error) {
        throw new Error('Failed to generate QR code buffer');
    }
};
exports.generateQRBuffer = generateQRBuffer;
