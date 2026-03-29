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

router.post('/', validate({ body: createPreApprovedEntrySchema }), createEntry);
router.get('/', validate({ query: preApprovedEntryQuerySchema }), listEntries);
router.get('/:id', validate({ params: idParams }), getEntry);
router.patch('/:id', validate({ params: idParams, body: updatePreApprovedEntrySchema }), updateEntry);
router.patch('/:id/cancel', validate({ params: idParams }), cancelEntry);
router.delete('/:id', validate({ params: idParams }), deleteEntry);
router.get('/:id/repeat', validate({ params: idParams }), repeatEntry);
router.get('/:id/usages', validate({ params: idParams, query: paginationQuery }), getUsageHistory);

export default router;
