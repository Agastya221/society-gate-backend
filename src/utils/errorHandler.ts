/**
 * Type-safe error handling utilities
 */

import { AppError } from './ResponseHandler';

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

/**
 * Safely extract HTTP status code from unknown error
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as { statusCode: unknown }).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }
  return 500;
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is a JWT error
 */
export function isJwtError(error: unknown): error is Error & { name: string } {
  return error instanceof Error && 'name' in error;
}
