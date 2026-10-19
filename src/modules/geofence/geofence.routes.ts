import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/Client';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParams } from '../../schemas';
import { AppError } from '../../utils/ResponseHandler';
import { clearGateCache, DEFAULT_RADIUS_METERS } from './geofence.service';

/** Admin side: where each gate is, and who tried to act away from it. Mounted at /api/v1/admin/geofence */
const router = Router();
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));
router.use(ensureSameSociety);

const gateBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(30).max(1000).optional(),
});

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  return res.status(500).json({ success: false, message: fallback });
};

router.get('/gates', async (req: Request, res: Response) => {
  const societyId = req.user!.societyId!;
  const gates = await prisma.gatePoint.findMany({
    where: { societyId, isActive: true },
    select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: gates });
});

// A new gate with its location (the admin is standing at it)
router.post('/gates', validate({ body: gateBody }), async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const { name, latitude, longitude, radiusMeters } = req.body;
    const gate = await prisma.gatePoint.create({
      data: { societyId, name: name ?? 'Main Gate', latitude, longitude, radiusMeters: radiusMeters ?? DEFAULT_RADIUS_METERS },
      select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    });
    clearGateCache(societyId);
    res.status(201).json({ success: true, message: 'Gate location saved', data: gate });
  } catch (error) {
    fail(res, error, 'Could not save the gate location');
  }
});

// Move an existing gate (or change its radius)
router.put('/gates/:id', validate({ params: idParams, body: gateBody }), async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const gate = await prisma.gatePoint.findFirst({ where: { id: req.params.id as string, societyId }, select: { id: true } });
    if (!gate) throw new AppError('Gate not found', 404);
    const { name, latitude, longitude, radiusMeters } = req.body;
    const updated = await prisma.gatePoint.update({
      where: { id: gate.id },
      data: { ...(name ? { name } : {}), latitude, longitude, ...(radiusMeters ? { radiusMeters } : {}) },
      select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    });
    clearGateCache(societyId);
    res.json({ success: true, message: 'Gate location saved', data: updated });
  } catch (error) {
    fail(res, error, 'Could not save the gate location');
  }
});

// Forget a gate's location. With no located gate left the society is not checked at all.
router.delete('/gates/:id/location', validate({ params: idParams }), async (req: Request, res: Response) => {
  const societyId = req.user!.societyId!;
  const changed = await prisma.gatePoint.updateMany({
    where: { id: req.params.id as string, societyId },
    data: { latitude: null, longitude: null },
  });
  clearGateCache(societyId);
  if (changed.count === 0) return res.status(404).json({ success: false, message: 'Gate not found' });
  return res.json({ success: true, message: 'Location removed. Guards are no longer checked at this gate.' });
});

router.get('/violations', async (req: Request, res: Response) => {
  const societyId = req.user!.societyId!;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const rows = await prisma.geofenceViolation.findMany({
    where: { societyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, action: true, code: true, distanceMeters: true, createdAt: true,
      guard: { select: { id: true, name: true } },
    },
  });
  res.json({ success: true, data: rows });
});

export default router;
