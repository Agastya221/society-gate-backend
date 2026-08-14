import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export type StaffTokenPayload = {
  staffAccountId: string;
  domesticStaffId: string;
  societyId: string;
  appType: 'STAFF_APP';
  type: 'access' | 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
};

const sign = (payload: Omit<StaffTokenPayload, 'jti'>, refresh = false) => jwt.sign(
  { ...payload, jti: crypto.randomUUID() },
  refresh ? process.env.JWT_REFRESH_SECRET! : process.env.JWT_SECRET!,
  { expiresIn: refresh ? '30d' : '1h' },
);

export const createStaffAccessToken = (accountId: string, staffId: string, societyId: string) =>
  sign({ staffAccountId: accountId, domesticStaffId: staffId, societyId, appType: 'STAFF_APP', type: 'access' });

export const createStaffRefreshToken = (accountId: string, staffId: string, societyId: string) =>
  sign({ staffAccountId: accountId, domesticStaffId: staffId, societyId, appType: 'STAFF_APP', type: 'refresh' }, true);

export const verifyStaffToken = (token: string, type: 'access' | 'refresh') => {
  const decoded = jwt.verify(token, type === 'refresh' ? process.env.JWT_REFRESH_SECRET! : process.env.JWT_SECRET!) as StaffTokenPayload;
  if (decoded.appType !== 'STAFF_APP' || decoded.type !== type) throw new jwt.JsonWebTokenError('Invalid staff token');
  return decoded;
};
