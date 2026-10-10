import { Router } from 'express';
import entryRequestRoutes from '../../modules/entry-request/entry-request.routes';
import gatepassRoutes from '../../modules/gatepass/gatepass.routes';
import guestInviteRoutes from '../../modules/guest-invite/guest-invite.routes';
import partyInviteRoutes from '../../modules/party-invite/party-invite.routes';
import preApprovedRoutes from '../../modules/pre-approved-entry/pre-approved-entry.routes';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { getEntries } from '../../modules/gate-scan/gate-scan.controller';
import {
  lookupVehicle,
  issueViolation,
  listViolations,
} from '../../modules/vehicle/parking-violation.controller';
import { prisma } from '../../utils/Client';
import { OCCUPIED_FLAT_WHERE } from '../../modules/onboarding/onboarding.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { Request, Response } from 'express';
import { getSocietyId } from '../../utils/scope';

const router = Router();

// -------------------------------------------------------
// Static routes BEFORE sub-router mounts (avoids conflicts)
// -------------------------------------------------------

// Entries log — accessible by residents (flat-scoped) and guards (society-wide)
router.get('/entries', authenticate, ensureSameSociety, getEntries);

// Parking — guard can lookup vehicles and issue violations
// Residents use /resident/parking/complaints and /resident/vehicles/search instead.
const gateStaff = authorize('GUARD', 'ADMIN', 'SUPER_ADMIN');
router.get('/parking/lookup', authenticate, ensureSameSociety, gateStaff, lookupVehicle);
router.get('/parking/violations', authenticate, ensureSameSociety, gateStaff, listViolations);
router.post('/parking/violations', authenticate, ensureSameSociety, gateStaff, issueViolation);
router.post('/parking/vehicles/:vehicleId/violations', authenticate, ensureSameSociety, gateStaff, issueViolation);

// Flat search — used by guard "New Entry" screen
// Guard "New Entry"/pre-approved screens only; no resident screen uses it (it lists resident names per flat).
router.get('/flats/search', authenticate, ensureSameSociety, gateStaff, async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const query = typeof req.query.query === 'string' ? req.query.query.trim().slice(0, 50) : '';

    if (!query) {
      return res.status(400).json({ success: false, message: 'query param is required' });
    }

    const flats = await prisma.flat.findMany({
      where: {
        societyId,
        isActive: true,
        // Real occupancy (owner/tenant/active membership), not the stale isOccupied column
        AND: [
          OCCUPIED_FLAT_WHERE,
          {
            OR: [
              { flatNumber: { contains: query, mode: 'insensitive' } },
              { block: { name: { contains: query, mode: 'insensitive' } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        flatNumber: true,
        block: { select: { name: true } },
        residents: {
          where: { isActive: true, role: 'RESIDENT' },
          select: { id: true, name: true },
        },
      },
      take: 20,
      orderBy: [{ block: { name: 'asc' } }, { flatNumber: 'asc' }],
    });

    return res.status(200).json({ success: true, data: flats });
  } catch (error: unknown) {
    return res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
});

// -------------------------------------------------------
// Sub-router mounts
// -------------------------------------------------------
router.use('/requests', entryRequestRoutes);       // /api/v1/gate/requests
router.use('/entry-requests', entryRequestRoutes); // /api/v1/gate/entry-requests (frontend alias)
router.use('/passes', gatepassRoutes);             // /api/v1/gate/passes

// New invite system
router.use('/invites/guest', guestInviteRoutes);   // /api/v1/gate/invites/guest
router.use('/invites/party', partyInviteRoutes);   // /api/v1/gate/invites/party

// Pre-approved entries (cab/delivery/help)
router.use('/pre-approved', preApprovedRoutes);    // /api/v1/gate/pre-approved

export default router;
