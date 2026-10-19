import { Router } from 'express';
import {
  createEntryRequest,
  getEntryRequests,
  getEntryRequestById,
  getEntryRequestPhoto,
  approveEntryRequest,
  admitEntryRequest,
  markEntryRequestNoShow,
  rejectEntryRequest,
  cancelEntryRequest,
  moveEntryRequest,
  revokeEntryRequest,
  getPendingCount,
  getGateQueue,
} from './entry-request.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { requireGuardAtGate } from '../geofence/geofence.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { approveEntryRequestSchema, createEntryRequestSchema, entryRequestQuerySchema, idParams, moveEntryRequestSchema } from '../../schemas';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes BEFORE parameterized routes
// May auto-approve (Society Settings → autoApproval), which moves status straight to
// APPROVED (the guard still admits at the gate to create the Entry) — clear entries too
router.post('/', authorize('GUARD'), requireGuardAtGate('Raise a visitor request'), validate({ body: createEntryRequestSchema }), clearCacheAfter(['entry-requests:*', 'entries:*']), createEntryRequest);
router.get('/pending-count', authorize('GUARD'), cache({ ttl: 10, keyPrefix: 'entry-requests', varyBy: ['userId'] }), getPendingCount);
// Not cached — the guard home screen polls this every 15s and needs the live queue.
router.get('/queue', authorize('GUARD'), getGateQueue);
router.get('/', validate({ query: entryRequestQuerySchema }), cache({ ttl: 20, keyPrefix: 'entry-requests', varyBy: ['societyId', 'userId'] }), getEntryRequests);

// Parameterized routes LAST
// Not cached: the guard polls this every few seconds while waiting, and every status
// change (approve/reject/cancel/cron expiry) must be visible immediately. The URL-only
// key also ignored the caller, so a cached body could bypass the per-user access check.
router.get('/:id', validate({ params: idParams }), getEntryRequestById);
router.get('/:id/photo', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), getEntryRequestPhoto);
// GUARD: "Allow Anyway" / "Turn Away" overrides — the service scopes guards to their own society
router.patch('/:id/approve', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN', 'GUARD'), requireGuardAtGate('Approve a visitor yourself'), validate({ params: idParams, body: approveEntryRequestSchema }), clearCacheAfter(['entry-requests:*', 'entries:*']), approveEntryRequest);
router.patch('/:id/revoke', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), clearCacheAfter(['entry-requests:*', 'entries:*']), revokeEntryRequest);
router.patch('/:id/move', authorize('GUARD'), requireGuardAtGate('Send a request to another flat'), validate({ params: idParams, body: moveEntryRequestSchema }), clearCacheAfter(['entry-requests:*']), moveEntryRequest);
router.patch('/:id/admit', authorize('GUARD'), requireGuardAtGate('Let a visitor in'), validate({ params: idParams }), clearCacheAfter(['entry-requests:*', 'entries:*']), admitEntryRequest);
router.patch('/:id/no-show', authorize('GUARD'), requireGuardAtGate('Clear a visitor who left'), validate({ params: idParams }), clearCacheAfter(['entry-requests:*']), markEntryRequestNoShow);
router.patch('/:id/reject', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN', 'GUARD'), requireGuardAtGate('Stop a visitor'), validate({ params: idParams }), clearCacheAfter(['entry-requests:*']), rejectEntryRequest);
router.patch('/:id/cancel', authorize('GUARD'), requireGuardAtGate('Withdraw a request'), validate({ params: idParams }), clearCacheAfter(['entry-requests:*']), cancelEntryRequest);

export default router;
