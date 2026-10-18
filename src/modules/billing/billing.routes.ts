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
  sendInvoiceReminder,
  listPaymentSubmissions,
  confirmPaymentSubmission,
  rejectPaymentSubmission,
} from './billing.controller';
import { adminPaymentSubmissionsQuerySchema, rejectPaymentSchema } from '../../schemas';

const router = Router();

// All billing routes require admin auth
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// month: "April 2026" | "2026-04" | "next month" (default when omitted)
// amountPerFlat: defaults to Society Settings maintenance.monthlyFee
// dueDate: defaults to Society Settings maintenance.dueDayOfMonth (else the 10th) of that month
const generateInvoicesSchema = z.object({
  month: z.string().trim().min(1).max(40).optional(),
  amountPerFlat: z.number().positive('Amount must be positive').optional(),
  description: z.string().max(500).optional(),
  dueDate: z.string().datetime({ message: 'Invalid due date' }).optional(),
});

const penaltySchema = z.object({
  amount: z.number().positive('Penalty amount must be positive'),
});

// POST /admin/billing/generate  — Bulk invoice generation
router.post(
  '/generate',
  validate({ body: generateInvoicesSchema }),
  clearCacheAfter(['billing:*']),
  generateInvoices,
);

// POST /admin/billing/penalty  — Apply late fee to all OVERDUE invoices
router.post(
  '/penalty',
  validate({ body: penaltySchema }),
  clearCacheAfter(['billing:*']),
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
  clearCacheAfter(['billing:*']),
  markInvoicePaid,
);

// PATCH /admin/billing/invoices/:id/waive
router.patch(
  '/invoices/:id/waive',
  clearCacheAfter(['billing:*']),
  waiveInvoice,
);

// POST /admin/billing/invoices/:id/reminder
router.post(
  '/invoices/:id/reminder',
  sendInvoiceReminder,
);

// GET /admin/billing/payment-submissions?status=SUBMITTED — residents' "I paid" reports to check
router.get(
  '/payment-submissions',
  validate({ query: adminPaymentSubmissionsQuerySchema }),
  listPaymentSubmissions,
);

// PATCH /admin/billing/payment-submissions/:id/confirm — matched to the bank statement: invoice PAID
router.patch(
  '/payment-submissions/:id/confirm',
  clearCacheAfter(['billing:*']),
  confirmPaymentSubmission,
);

// PATCH /admin/billing/payment-submissions/:id/reject — could not match it
router.patch(
  '/payment-submissions/:id/reject',
  validate({ body: rejectPaymentSchema }),
  clearCacheAfter(['billing:*']),
  rejectPaymentSubmission,
);

export default router;
