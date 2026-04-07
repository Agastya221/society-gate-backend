import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { z } from 'zod';
import {
  generateInvoices,
  applyPenalty,
  listDues,
  markInvoicePaid,
  waiveInvoice,
} from './billing.controller';

const router = Router();

// All billing routes require admin auth
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

const generateInvoicesSchema = z.object({
  month: z.string().min(1, 'Month is required'),           // e.g. "April 2024"
  amountPerFlat: z.number().positive('Amount must be positive'),
  description: z.string().max(500).optional(),
  dueDate: z.string().datetime({ message: 'Invalid due date' }),
});

const penaltySchema = z.object({
  amount: z.number().positive('Penalty amount must be positive'),
});

// POST /admin/billing/generate  — Bulk invoice generation
router.post(
  '/generate',
  validate({ body: generateInvoicesSchema }),
  clearCacheAfter(['api:billing*', 'api:dues*']),
  generateInvoices,
);

// POST /admin/billing/penalty  — Apply late fee to all OVERDUE invoices
router.post(
  '/penalty',
  validate({ body: penaltySchema }),
  clearCacheAfter(['api:billing*', 'api:dues*']),
  applyPenalty,
);

// GET /admin/dues  — List all society invoices
router.get(
  '/dues',
  cache({ ttl: 60, keyPrefix: 'billing', varyBy: ['societyId'] }),
  listDues,
);

// PATCH /admin/billing/invoices/:id/paid
router.patch(
  '/invoices/:id/paid',
  clearCacheAfter(['api:billing*', 'api:dues*']),
  markInvoicePaid,
);

// PATCH /admin/billing/invoices/:id/waive
router.patch(
  '/invoices/:id/waive',
  clearCacheAfter(['api:billing*', 'api:dues*']),
  waiveInvoice,
);

export default router;
