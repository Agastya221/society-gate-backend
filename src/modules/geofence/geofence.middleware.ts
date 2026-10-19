import type { NextFunction, Request, Response } from 'express';
import { evaluate, logViolation, readingFromHeaders } from './geofence.service';

/**
 * Guards only: the action must come from a phone that is at one of the society's gates.
 * Residents and admins pass straight through (the same routes serve them), and so does a society
 * that has not set a gate location yet.
 */
export const requireGuardAtGate = (action: string) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'GUARD' || !user.societyId) return next();

    const reading = readingFromHeaders(req.headers);
    const verdict = await evaluate(user.societyId, reading);
    if (verdict.ok) return next();

    void logViolation(user.societyId, user.id, action, verdict, reading);
    return res.status(403).json({ success: false, code: verdict.code, message: verdict.message });
  } catch (err) {
    return next(err);
  }
};
