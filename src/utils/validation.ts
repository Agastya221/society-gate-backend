import { AppError } from './ResponseHandler';

/**
 * Validation utilities for ensuring data integrity
 */

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * Validate required fields exist in an object
 */
export function validateRequiredFields(data: Record<string, unknown> | object, fields: string[], entityName: string = 'Data') {
  const record = data as Record<string, unknown>;
  const missingFields: string[] = [];

  for (const field of fields) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new ValidationError(
      `${entityName} is missing required fields: ${missingFields.join(', ')}`
    );
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends Record<string, unknown>>(value: unknown, enumObj: T, fieldName: string): value is T[keyof T] {
  const validValues = Object.values(enumObj);
  if (!validValues.includes(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}: ${value}. Must be one of: ${validValues.join(', ')}`
    );
  }
  return true;
}

/**
 * Validate date is in future
 */
export function validateFutureDate(date: Date | string, fieldName: string = 'Date') {
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
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  fieldNames: { start: string; end: string } = { start: 'Start date', end: 'End date' }
) {
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
export function validateTimeFormat(time: string, fieldName: string = 'Time') {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (!timeRegex.test(time)) {
    throw new ValidationError(`Invalid ${fieldName} format. Expected HH:MM (e.g., 09:30)`);
  }
}

/**
 * Validate time range
 */
export function validateTimeRange(startTime: string, endTime: string) {
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
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'Value'
) {
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
export function validatePhoneNumber(phone: string, fieldName: string = 'Phone number') {
  // Accepts formats: 9876543210, +919876543210, 09876543210
  const phoneRegex = /^(\+91)?0?[6-9]\d{9}$/;

  if (!phoneRegex.test(phone)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string, fieldName: string = 'Email') {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(id: string, fieldName: string = 'ID') {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

/**
 * Validate array is not empty
 */
export function validateNonEmptyArray(arr: unknown[], fieldName: string = 'Array') {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty array`);
  }
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(value: number, fieldName: string = 'Value') {
  if (typeof value !== 'number' || isNaN(value) || value <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
}

/**
 * Sanitize string input (remove extra whitespace, trim)
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/\s+/g, ' ');
}
