import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_ALGORITHM, STAFF_TOKEN_AUDIENCE } from '../../services/token.service';

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

// Staff tokens share JWT_SECRET / JWT_REFRESH_SECRET with user tokens, so they carry
// their own audience: a staff token never passes verifyAccessToken (aud 'sgate-user')
// and a user token never passes verifyStaffToken.
const sign = (payload: Omit<StaffTokenPayload, 'jti'>, refresh = false) => jwt.sign(
  { ...payload, jti: crypto.randomUUID() },
  refresh ? process.env.JWT_REFRESH_SECRET! : process.env.JWT_SECRET!,
  { expiresIn: refresh ? '30d' : '1h', audience: STAFF_TOKEN_AUDIENCE, algorithm: JWT_ALGORITHM },
);

export const createStaffAccessToken = (accountId: string, staffId: string, societyId: string) =>
  sign({ staffAccountId: accountId, domesticStaffId: staffId, societyId, appType: 'STAFF_APP', type: 'access' });

export const createStaffRefreshToken = (accountId: string, staffId: string, societyId: string) =>
  sign({ staffAccountId: accountId, domesticStaffId: staffId, societyId, appType: 'STAFF_APP', type: 'refresh' }, true);

export const verifyStaffToken = (token: string, type: 'access' | 'refresh') => {
  const decoded = jwt.verify(
    token,
    type === 'refresh' ? process.env.JWT_REFRESH_SECRET! : process.env.JWT_SECRET!,
    { algorithms: [JWT_ALGORITHM], audience: STAFF_TOKEN_AUDIENCE },
  ) as StaffTokenPayload;
  if (decoded.appType !== 'STAFF_APP' || decoded.type !== type || typeof decoded.staffAccountId !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid staff token');
  }
  return decoded;
};
