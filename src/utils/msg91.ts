import axios from 'axios';
import logger from './logger';
import { AppError } from './ResponseHandler';

const WIDGET_AUTH_KEY = process.env.MSG91_WIDGET_AUTH_KEY || process.env.MSG91_API_KEY;

if (!WIDGET_AUTH_KEY) {
  throw new Error('MSG91_WIDGET_AUTH_KEY (or MSG91_API_KEY) is not set in environment variables');
}

interface MSG91WidgetVerifyResponse {
  message: string;
  mobile?: string;
  type?: string;
  code?: string;
}

/**
 * Verifies the JWT access-token issued by the MSG91 OTP Widget.
 *
 * Flow:
 *  1. Frontend embeds the MSG91 OTP Widget (handles SMS send + OTP input UI)
 *  2. On success, Widget gives the frontend a short-lived JWT ("access-token")
 *  3. Frontend sends that JWT to our backend
 *  4. We call this function to verify it with MSG91
 *  5. MSG91 returns the verified phone number
 *  6. We use that phone to find/create the user and issue our own JWT
 *
 * @param widgetToken - The JWT token received from the MSG91 OTP Widget on the frontend
 * @returns The verified phone number in 10-digit Indian format
 */
export async function verifyMSG91WidgetToken(widgetToken: string): Promise<string> {
  try {
    const response = await axios.post<MSG91WidgetVerifyResponse>(
      'https://control.msg91.com/api/v5/widget/verifyAccessToken',
      {
        authkey: WIDGET_AUTH_KEY,
        'access-token': widgetToken,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      }
    );

    const data = response.data;
    logger.info({ status: data.message, mobile: data.mobile }, 'MSG91 widget token verified');

    if (data.message !== 'success' || !data.mobile) {
      throw new AppError(data.message || 'OTP verification failed', 400);
    }

    return normalisePhone(data.mobile);
  } catch (err: any) {
    // Re-throw AppErrors as-is so the status code is preserved
    if (err instanceof AppError) throw err;

    const msg91Error = err?.response?.data?.message || err?.message;
    logger.error({ error: msg91Error }, 'MSG91 widget token verification failed');

    if (err?.response?.status === 401 || msg91Error?.toLowerCase().includes('invalid')) {
      throw new AppError('OTP is invalid or has expired. Please try again.', 400);
    }

    throw new AppError('Could not verify OTP. Please try again.', 502);
  }
}

/**
 * Normalise phone to 10-digit Indian format (stored in DB without country code).
 * MSG91 returns "91XXXXXXXXXX" — we strip the "91" prefix for DB storage.
 */
function normalisePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  if (cleaned.length === 10) return cleaned;
  return cleaned;
}
