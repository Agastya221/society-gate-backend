import { Router } from 'express';
import { authenticate, ensureSameSociety } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  idParams,
  createPreApprovedEntrySchema,
  updatePreApprovedEntrySchema,
  preApprovedEntryQuerySchema,
  paginationQuery,
} from '../../schemas';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import {
  createEntry,
  listEntries,
  getEntry,
  updateEntry,
  cancelEntry,
  deleteEntry,
  repeatEntry,
  getUsageHistory,
} from './pre-approved-entry.controller';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

router.post('/', validate({ body: createPreApprovedEntrySchema }), clearCacheAfter(['api:pre-approved*']), createEntry);
router.get('/', validate({ query: preApprovedEntryQuerySchema }), cache({ ttl: 120, keyPrefix: 'pre-approved', varyBy: ['userId', 'societyId'] }), listEntries);
router.get('/:id', validate({ params: idParams }), cache({ ttl: 120, keyPrefix: 'pre-approved' }), getEntry);
router.patch('/:id', validate({ params: idParams, body: updatePreApprovedEntrySchema }), clearCacheAfter(['api:pre-approved*']), updateEntry);
router.patch('/:id/cancel', validate({ params: idParams }), clearCacheAfter(['api:pre-approved*']), cancelEntry);
router.delete('/:id', validate({ params: idParams }), clearCacheAfter(['api:pre-approved*']), deleteEntry);
router.get('/:id/repeat', validate({ params: idParams }), clearCacheAfter(['api:pre-approved*']), repeatEntry);
router.get('/:id/usages', validate({ params: idParams, query: paginationQuery }), cache({ ttl: 60, keyPrefix: 'pre-approved' }), getUsageHistory);

export default router;
