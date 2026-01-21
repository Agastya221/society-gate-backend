"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validateRequiredFields = validateRequiredFields;
exports.validateEnum = validateEnum;
exports.validateFutureDate = validateFutureDate;
exports.validateDateRange = validateDateRange;
exports.validateTimeFormat = validateTimeFormat;
exports.validateTimeRange = validateTimeRange;
exports.validateNumberRange = validateNumberRange;
exports.validatePhoneNumber = validatePhoneNumber;
exports.validateEmail = validateEmail;
exports.validateUUID = validateUUID;
exports.validateNonEmptyArray = validateNonEmptyArray;
exports.validatePositiveNumber = validatePositiveNumber;
exports.sanitizeString = sanitizeString;
const ResponseHandler_1 = require("./ResponseHandler");
/**
 * Validation utilities for ensuring data integrity
 */
class ValidationError extends ResponseHandler_1.AppError {
    constructor(message) {
        super(message, 400);
    }
}
exports.ValidationError = ValidationError;
/**
 * Validate required fields exist in an object
 */
function validateRequiredFields(data, fields, entityName = 'Data') {
    const missingFields = [];
    for (const field of fields) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            missingFields.push(field);
        }
    }
    if (missingFields.length > 0) {
        throw new ValidationError(`${entityName} is missing required fields: ${missingFields.join(', ')}`);
    }
}
/**
 * Validate enum value
 */
function validateEnum(value, enumObj, fieldName) {
    const validValues = Object.values(enumObj);
    if (!validValues.includes(value)) {
        throw new ValidationError(`Invalid ${fieldName}: ${value}. Must be one of: ${validValues.join(', ')}`);
    }
    return true;
}
/**
 * Validate date is in future
 */
function validateFutureDate(date, fieldName = 'Date') {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
        throw new ValidationError(`Invalid ${fieldName} format`);
    }
    if (dateObj < new Date()) {
        throw new ValidationError(`${fieldName} must be in the future`);
    }
}
/**
 * Validate date range
 */
function validateDateRange(startDate, endDate, fieldNames = { start: 'Start date', end: 'End date' }) {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    if (isNaN(start.getTime())) {
        throw new ValidationError(`Invalid ${fieldNames.start} format`);
    }
    if (isNaN(end.getTime())) {
        throw new ValidationError(`Invalid ${fieldNames.end} format`);
    }
    if (start >= end) {
        throw new ValidationError(`${fieldNames.start} must be before ${fieldNames.end}`);
    }
}
/**
 * Validate time format (HH:MM)
 */
function validateTimeFormat(time, fieldName = 'Time') {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
        throw new ValidationError(`Invalid ${fieldName} format. Expected HH:MM (e.g., 09:30)`);
    }
}
/**
 * Validate time range
 */
function validateTimeRange(startTime, endTime) {
    validateTimeFormat(startTime, 'Start time');
    validateTimeFormat(endTime, 'End time');
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    if (startMinutes >= endMinutes) {
        throw new ValidationError('Start time must be before end time');
    }
}
/**
 * Validate number range
 */
function validateNumberRange(value, min, max, fieldName = 'Value') {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`${fieldName} must be a valid number`);
    }
    if (value < min || value > max) {
        throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
    }
}
/**
 * Validate phone number (basic Indian format)
 */
function validatePhoneNumber(phone, fieldName = 'Phone number') {
    // Accepts formats: 9876543210, +919876543210, 09876543210
    const phoneRegex = /^(\+91)?0?[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        throw new ValidationError(`Invalid ${fieldName} format`);
    }
}
/**
 * Validate email format
 */
function validateEmail(email, fieldName = 'Email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError(`Invalid ${fieldName} format`);
    }
}
/**
 * Validate UUID format
 */
function validateUUID(id, fieldName = 'ID') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        throw new ValidationError(`Invalid ${fieldName} format`);
    }
}
/**
 * Validate array is not empty
 */
function validateNonEmptyArray(arr, fieldName = 'Array') {
    if (!Array.isArray(arr) || arr.length === 0) {
        throw new ValidationError(`${fieldName} must be a non-empty array`);
    }
}
/**
 * Validate positive number
 */
function validatePositiveNumber(value, fieldName = 'Value') {
    if (typeof value !== 'number' || isNaN(value) || value <= 0) {
        throw new ValidationError(`${fieldName} must be a positive number`);
    }
}
/**
 * Sanitize string input (remove extra whitespace, trim)
 */
function sanitizeString(str) {
    if (typeof str !== 'string')
        return str;
    return str.trim().replace(/\s+/g, ' ');
}
