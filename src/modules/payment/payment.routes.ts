import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  cashfreeWebhook,
  createInvoiceCashfreeOrder,
  getInvoiceCashfreeStatus,
} from './payment.controller';

const router = Router();

const invoiceParamsSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice id'),
});

const createCashfreeOrderSchema = z.object({
  returnUrl: z.string().url('Invalid return URL').optional(),
  notifyUrl: z.string().url('Invalid notify URL').optional(),
  customerPhone: z.string().min(10).max(20).optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().min(3).max(100).optional(),
});

const statusQuerySchema = z.object({
  sync: z.enum(['true', 'false']).optional(),
});

router.post('/cashfree/webhook', cashfreeWebhook);

router.use(authenticate);

router.post(
  '/invoices/:invoiceId/cashfree/order',
  validate({ params: invoiceParamsSchema, body: createCashfreeOrderSchema }),
  createInvoiceCashfreeOrder,
);

router.get(
  '/invoices/:invoiceId/cashfree/status',
  validate({ params: invoiceParamsSchema, query: statusQuerySchema }),
  getInvoiceCashfreeStatus,
);

export default router;
