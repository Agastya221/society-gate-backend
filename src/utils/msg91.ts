import axios from 'axios';
import logger from './logger';
import { AppError } from './ResponseHandler';

// ============================================
// MSG91 CONFIGURATION
// ============================================
// ENV variable names:
//   MSG91_AUTH_KEY    — MSG91 ACCOUNT authkey (Dashboard → Authkey). Used by backend for server-side API calls.
//   MSG91_WIDGET_ID  — OTP Widget ID (Dashboard → OTP Widget → Widget ID). Frontend SDK only, not used here.
//   MSG91_TOKEN_AUTH — OTP Widget Token (Dashboard → OTP Widget → Token). Frontend SDK only, not used here.

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;

if (!MSG91_AUTH_KEY) {
  throw new Error(
    'MSG91_AUTH_KEY is not set in environment variables. ' +
    'Set this to your MSG91 ACCOUNT authkey (Dashboard → Authkey section).'
  );
}


interface MSG91WidgetVerifyResponse {
  message: string;
  mobile?: string;
  type?: string;
  code?: string;
}

/**
 * Verifies the JWT access-token issued by the MSG91 OTP Widget / SendOTP SDK.
 *
 * Flow:
 *  1. Frontend uses MSG91 SendOTP React Native SDK
 *  2. SDK handles OTP send + verify internally, returns a JWT "access-token"
 *  3. Frontend sends that JWT to our backend as `widgetToken`
 *  4. We call MSG91's verifyAccessToken API with our ACCOUNT authkey (MSG91_AUTH_KEY)
 *  5. MSG91 returns the verified phone number
 *  6. We use that phone to find/create the user and issue our own JWT
 *
 * @param widgetToken - The JWT token from the MSG91 SDK on the frontend
 * @returns The verified phone number in 10-digit Indian format
 */
export async function verifyMSG91WidgetToken(widgetToken: string): Promise<string> {
  try {
    const response = await axios.post<MSG91WidgetVerifyResponse>(
      'https://control.msg91.com/api/v5/widget/verifyAccessToken',
      {
        authkey: MSG91_AUTH_KEY,
        'access-token': widgetToken,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      }
    );

    const data = response.data;
    logger.info('MSG91 widget token verified');

    // MSG91 verifyAccessToken returns phone in `message` field and status in `type` field
    // e.g. { "message": "916202923165", "type": "success" }
    // OR   { "message": "success", "mobile": "916202923165" } (older format)
    const phone = data.mobile || (data.type === 'success' ? data.message : null);

    if (!phone) {
      throw new AppError(data.message || 'OTP verification failed', 400);
    }

    return normalisePhone(phone);
  } catch (err: any) {
    if (err instanceof AppError) throw err;

    const status = err?.response?.status;
    const msg91Error = err?.response?.data?.message || err?.message;

    // Only message + status: never the request config (it carries the authkey)
    // or the widget token.
    logger.error(
      {
        error: typeof msg91Error === 'string' ? msg91Error : 'unknown error',
        httpStatus: status,
        msg91Type: err?.response?.data?.type,
      },
      'MSG91 verifyAccessToken failed'
    );

    if (status === 401 || msg91Error?.toLowerCase().includes('invalid')) {
      throw new AppError('OTP is invalid or has expired. Please try again.', 400);
    }

    throw new AppError('Could not verify OTP. Please try again.', 502);
  }
}

/**
 * Normalise phone to 10-digit Indian mobile format.
 * MSG91 returns "91XXXXXXXXXX" — we strip the "91" prefix. Anything that is not a
 * valid Indian mobile number afterwards is rejected (never used as an identity).
 */
function normalisePhone(phone: string): string {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);
  else if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);

  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    logger.warn({ length: cleaned.length }, 'MSG91 returned a phone number that is not a valid Indian mobile');
    throw new AppError('OTP verification returned an invalid mobile number. Please try again.', 400);
  }
  return cleaned;
}
