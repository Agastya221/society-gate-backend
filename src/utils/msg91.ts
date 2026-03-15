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

logger.info(
  `[MSG91] Auth key loaded: ${MSG91_AUTH_KEY.substring(0, 6)}...${MSG91_AUTH_KEY.substring(MSG91_AUTH_KEY.length - 4)} (length: ${MSG91_AUTH_KEY.length})`
);

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
    logger.info({ status: data.message, mobile: data.mobile }, 'MSG91 widget token verified');

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

    logger.error(
      {
        error: msg91Error,
        httpStatus: status,
        responseData: err?.response?.data,
        authKeyLength: MSG91_AUTH_KEY?.length,
        tokenPrefix: widgetToken?.substring(0, 30),
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
 * Normalise phone to 10-digit Indian format.
 * MSG91 returns "91XXXXXXXXXX" — we strip the "91" prefix.
 */
function normalisePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  if (cleaned.length === 10) return cleaned;
  return cleaned;
}
