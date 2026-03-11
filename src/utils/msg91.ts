import axios from 'axios';
import logger from './logger';

const WIDGET_AUTH_KEY = process.env.MSG91_WIDGET_AUTH_KEY || process.env.MSG91_API_KEY!;

interface MSG91WidgetVerifyResponse {
  message: string;
  mobile?: string;       // e.g. "919876543210"
  type?: string;         // "success" | "error"
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
 * @returns The verified phone number in E.164 format (e.g. "919876543210")
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
      throw new Error(data.message || 'OTP verification failed');
    }

    // MSG91 returns mobile as "91XXXXXXXXXX" — normalise to our DB format
    return normalisePhone(data.mobile);
  } catch (err: any) {
    const msg91Error = err?.response?.data?.message || err?.message;
    logger.error({ error: msg91Error }, 'MSG91 widget token verification failed');

    if (err?.response?.status === 401 || msg91Error?.toLowerCase().includes('invalid')) {
      throw new Error('OTP is invalid or has expired. Please try again.');
    }

    throw new Error('Could not verify OTP. Please try again.');
  }
}

/**
 * Normalise phone to 10-digit Indian format (stored in DB without country code).
 * MSG91 returns "91XXXXXXXXXX" — we strip the "91" prefix for DB storage.
 */
function normalisePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  // MSG91 returns 91XXXXXXXXXX (12 digits) — strip country code
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  // Already 10 digits
  if (cleaned.length === 10) return cleaned;
  return cleaned;
}
