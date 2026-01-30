import QRCode from 'qrcode';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

// ============================================
// GENERATE QR TOKEN (JWT)
// ============================================
export const generateQRToken = (
  payload: string | object,
  expiresIn: SignOptions['expiresIn'] = '10y'
): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }

  const options: SignOptions = { expiresIn };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET as jwt.Secret,
    options
  );
};

// ============================================
// VERIFY QR TOKEN
// ============================================
export const verifyQRToken = (token: string): JwtPayload | string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET as jwt.Secret
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new Error('QR code expired');
    }
    throw new Error('Invalid QR code');
  }
};

// ============================================
// GENERATE QR CODE IMAGE (Base64)
// ============================================
export const generateQRImage = async (
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> => {
  try {
    const qrOptions = {
      errorCorrectionLevel: 'M' as const,
      type: 'image/png' as const,
      width: options?.width || 300,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
    };

    // Generate QR as base64 data URL
    const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);
    return qrCodeDataURL; // Returns: "data:image/png;base64,iVBORw0KG..."
  } catch (error) {
    throw new Error('Failed to generate QR code image');
  }
};

// ============================================
// GENERATE QR CODE BUFFER (For file download)
// ============================================
export const generateQRBuffer = async (data: string): Promise<Buffer> => {
  try {
    return await QRCode.toBuffer(data, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 2,
    });
  } catch (error) {
    throw new Error('Failed to generate QR code buffer');
  }
};
