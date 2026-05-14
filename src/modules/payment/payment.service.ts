import { randomUUID } from 'crypto';
import { prisma } from '../../utils/Client';
import logger from '../../utils/logger';
import type { AuthenticatedUser } from '../../types';
import {
  cashfreeClient,
  type CashfreeCustomerDetails,
} from './cashfree.client';

interface CreateInvoiceOrderInput {
  invoiceId: string;
  user: AuthenticatedUser;
  returnUrl?: string;
  notifyUrl?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
}

interface PaymentWebhookPayload {
  type?: string;
  event_time?: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number;
      order_currency?: string;
    };
    payment?: {
      cf_payment_id?: string;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_message?: string;
      payment_time?: string;
    };
  };
}

type TransactionStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'SUCCESS'
  | 'FAILED'
  | 'USER_DROPPED'
  | 'EXPIRED'
  | 'CANCELLED';

type InvoiceForPayment = {
  id: string;
  month: string;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
  paidAt: Date | null;
  flatId: string;
  societyId: string;
  flat: {
    id: string;
    flatNumber: string;
    ownerName: string | null;
    ownerPhone: string | null;
    ownerEmail: string | null;
    residents: Array<{
      id: string;
      name: string;
      phone: string;
      email: string | null;
    }>;
  };
};

export class PaymentService {
  async createInvoiceCashfreeOrder(input: CreateInvoiceOrderInput) {
    const invoice = await this.getInvoiceForPayment(input.invoiceId, input.user);

    if (invoice.status === 'PAID') {
      return {
        alreadyPaid: true,
        invoiceId: invoice.id,
        status: invoice.status,
        paidAt: invoice.paidAt,
      };
    }

    if (invoice.status === 'WAIVED') {
      throw new Error('Invoice has been waived and cannot be paid');
    }

    const existingTransaction = await prisma.paymentTransaction.findFirst({
      where: {
        invoiceId: invoice.id,
        provider: 'CASHFREE',
        status: { in: ['CREATED', 'ACTIVE'] },
        paymentSessionId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingTransaction?.paymentSessionId) {
      return {
        alreadyPaid: false,
        reused: true,
        invoiceId: invoice.id,
        transactionId: existingTransaction.id,
        cashfreeOrderId: existingTransaction.cashfreeOrderId,
        paymentSessionId: existingTransaction.paymentSessionId,
        amount: existingTransaction.amount,
        currency: existingTransaction.currency,
        status: existingTransaction.status,
      };
    }

    const transactionCount = await prisma.paymentTransaction.count({
      where: { invoiceId: invoice.id, provider: 'CASHFREE' },
    });
    const cashfreeOrderId = createCashfreeOrderId(invoice.id, transactionCount);
    const idempotencyKey = randomUUID();
    const customer = resolveCustomerDetails(invoice, input.user, {
      phone: input.customerPhone,
      email: input.customerEmail,
      name: input.customerName,
    });
    const returnUrl = resolveUrl(input.returnUrl || process.env.CASHFREE_RETURN_URL, invoice.id, cashfreeOrderId);
    const notifyUrl = resolveUrl(input.notifyUrl || process.env.CASHFREE_NOTIFY_URL, invoice.id, cashfreeOrderId);
    const amount = roundAmount(invoice.totalAmount);

    const cashfreeOrder = await cashfreeClient.createOrder({
      orderId: cashfreeOrderId,
      amount,
      currency: 'INR',
      customer,
      idempotencyKey,
      returnUrl,
      notifyUrl,
      orderNote: `Invoice ${invoice.month}`,
      orderTags: {
        invoiceId: invoice.id,
        flatId: invoice.flatId,
        societyId: invoice.societyId,
        month: invoice.month,
      },
    });

    const transaction = await prisma.paymentTransaction.create({
      data: {
        provider: 'CASHFREE',
        status: mapCashfreeOrderStatus(cashfreeOrder.order_status),
        amount,
        currency: cashfreeOrder.order_currency || 'INR',
        cashfreeOrderId,
        cashfreeCfOrderId: cashfreeOrder.cf_order_id,
        paymentSessionId: cashfreeOrder.payment_session_id,
        idempotencyKey,
        rawResponse: cashfreeOrder as any,
        invoiceId: invoice.id,
      },
    });

    return {
      alreadyPaid: false,
      reused: false,
      invoiceId: invoice.id,
      transactionId: transaction.id,
      cashfreeOrderId: transaction.cashfreeOrderId,
      cfOrderId: transaction.cashfreeCfOrderId,
      paymentSessionId: transaction.paymentSessionId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
    };
  }

  async getInvoiceCashfreeStatus(invoiceId: string, user: AuthenticatedUser, syncWithCashfree = false) {
    const invoice = await this.getInvoiceForPayment(invoiceId, user, { allowPaid: true, allowWaived: true });
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { invoiceId: invoice.id, provider: 'CASHFREE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!transaction) {
      return {
        invoiceId: invoice.id,
        invoiceStatus: invoice.status,
        transaction: null,
      };
    }

    if (syncWithCashfree && transaction.status !== 'SUCCESS') {
      await this.syncCashfreeOrder(transaction.cashfreeOrderId);
    }

    const refreshed = await prisma.paymentTransaction.findUnique({
      where: { id: transaction.id },
    });
    const refreshedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      select: { status: true, paidAt: true },
    });

    return {
      invoiceId: invoice.id,
      invoiceStatus: refreshedInvoice?.status || invoice.status,
      paidAt: refreshedInvoice?.paidAt || invoice.paidAt,
      transaction: refreshed
        ? {
            id: refreshed.id,
            status: refreshed.status,
            cashfreeOrderId: refreshed.cashfreeOrderId,
            cashfreePaymentId: refreshed.cashfreePaymentId,
            paymentSessionId: refreshed.paymentSessionId,
            amount: refreshed.amount,
            currency: refreshed.currency,
            webhookEventType: refreshed.webhookEventType,
            webhookReceivedAt: refreshed.webhookReceivedAt,
          }
        : null,
    };
  }

  async handleCashfreeWebhook(headers: Record<string, string | string[] | undefined>, rawBody?: Buffer) {
    const signature = getSingleHeader(headers['x-webhook-signature']);
    const timestamp = getSingleHeader(headers['x-webhook-timestamp']);

    if (!rawBody || !signature || !timestamp) {
      throw new Error('Missing Cashfree webhook signature, timestamp, or raw body');
    }

    const isValid = cashfreeClient.verifyWebhookSignature(signature, rawBody, timestamp);
    if (!isValid) {
      throw new Error('Invalid Cashfree webhook signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as PaymentWebhookPayload;
    const orderId = payload.data?.order?.order_id;

    if (!orderId) {
      logger.warn({ payload }, 'Cashfree webhook ignored because order_id is missing');
      return { processed: false, reason: 'missing_order_id' };
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { cashfreeOrderId: orderId },
      include: { invoice: true },
    });

    if (!transaction) {
      logger.warn({ orderId, eventType: payload.type }, 'Cashfree webhook ignored for unknown order');
      return { processed: false, reason: 'unknown_order' };
    }

    const status = mapCashfreePaymentStatus(payload.data?.payment?.payment_status, payload.type);
    const paymentAmount = payload.data?.payment?.payment_amount ?? payload.data?.order?.order_amount;
    const paymentCurrency = payload.data?.payment?.payment_currency ?? payload.data?.order?.order_currency;
    const amountMatches =
      status !== 'SUCCESS' ||
      (typeof paymentAmount === 'number' &&
        roundAmount(paymentAmount) >= roundAmount(transaction.amount) &&
        (paymentCurrency || transaction.currency) === transaction.currency);
    const shouldMarkPaid = status === 'SUCCESS' && amountMatches && transaction.invoice.status !== 'PAID';

    await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status,
          cashfreePaymentId: payload.data?.payment?.cf_payment_id || transaction.cashfreePaymentId,
          webhookEventType: payload.type,
          webhookReceivedAt: new Date(),
          rawWebhook: payload as any,
        },
      });

      if (shouldMarkPaid) {
        await tx.invoice.update({
          where: { id: transaction.invoiceId },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }
    });

    if (status === 'SUCCESS' && !amountMatches) {
      logger.error(
        {
          orderId,
          expectedAmount: transaction.amount,
          paymentAmount,
          expectedCurrency: transaction.currency,
          paymentCurrency,
        },
        'Cashfree success webhook amount/currency mismatch; invoice was not marked paid',
      );
    }

    return {
      processed: true,
      invoicePaid: shouldMarkPaid,
      transactionId: transaction.id,
      invoiceId: transaction.invoiceId,
      status,
    };
  }

  private async syncCashfreeOrder(cashfreeOrderId: string) {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { cashfreeOrderId },
      include: { invoice: true },
    });

    if (!transaction) return;

    const order = await cashfreeClient.fetchOrder(cashfreeOrderId);
    const status = mapCashfreeOrderStatus(order.order_status);
    const amountMatches =
      status !== 'SUCCESS' ||
      (typeof order.order_amount === 'number' &&
        roundAmount(order.order_amount) >= roundAmount(transaction.amount) &&
        (order.order_currency || transaction.currency) === transaction.currency);

    await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status,
          cashfreeCfOrderId: order.cf_order_id || transaction.cashfreeCfOrderId,
          paymentSessionId: order.payment_session_id || transaction.paymentSessionId,
          rawResponse: order as any,
        },
      });

      if (status === 'SUCCESS' && amountMatches && transaction.invoice.status !== 'PAID') {
        await tx.invoice.update({
          where: { id: transaction.invoiceId },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }
    });
  }

  private async getInvoiceForPayment(
    invoiceId: string,
    user: AuthenticatedUser,
    opts: { allowPaid?: boolean; allowWaived?: boolean } = {},
  ): Promise<InvoiceForPayment> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        flat: {
          select: {
            id: true,
            flatNumber: true,
            ownerName: true,
            ownerPhone: true,
            ownerEmail: true,
            residents: {
              where: { isPrimaryResident: true, isActive: true },
              select: { id: true, name: true, phone: true, email: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (!opts.allowPaid && invoice.status === 'PAID') throw new Error('Invoice is already paid');
    if (!opts.allowWaived && invoice.status === 'WAIVED') throw new Error('Invoice has been waived');

    if (user.role !== 'SUPER_ADMIN') {
      if (!user.societyId || invoice.societyId !== user.societyId) {
        throw new Error('Invoice not found');
      }

      if (user.role === 'RESIDENT' && invoice.flatId !== user.flatId) {
        throw new Error('Invoice not found');
      }

      if (user.role === 'GUARD') {
        throw new Error('Guards cannot initiate invoice payments');
      }
    }

    return invoice;
  }
}

function resolveCustomerDetails(
  invoice: InvoiceForPayment,
  user: AuthenticatedUser,
  overrides: { phone?: string; email?: string; name?: string },
): CashfreeCustomerDetails {
  const primaryResident = invoice.flat.residents[0];
  const phone = normalizePhone(
    overrides.phone || primaryResident?.phone || invoice.flat.ownerPhone || user.phone,
  );

  if (!phone) {
    throw new Error('A valid 10 digit customer phone number is required for Cashfree');
  }

  const customerId = sanitizeCustomerId(primaryResident?.id || user.id || invoice.flatId);
  const email = overrides.email || primaryResident?.email || invoice.flat.ownerEmail || user.email || undefined;
  const name = overrides.name || primaryResident?.name || invoice.flat.ownerName || user.name || undefined;

  return {
    customer_id: customerId,
    customer_phone: phone,
    ...(email ? { customer_email: email } : {}),
    ...(name && name.length >= 3 ? { customer_name: name.slice(0, 100) } : {}),
  };
}

function createCashfreeOrderId(invoiceId: string, existingCount: number): string {
  const compactInvoiceId = invoiceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  if (existingCount === 0) return `inv_${compactInvoiceId}`;

  return `inv_${compactInvoiceId}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function resolveUrl(url: string | undefined, invoiceId: string, orderId: string): string | undefined {
  if (!url) return undefined;

  return url.replace(/\{invoice_id\}/g, invoiceId).replace(/\{order_id\}/g, orderId);
}

function normalizePhone(phone?: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') || '';
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function sanitizeCustomerId(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]/g, '');
  return clean.length >= 3 ? clean.slice(0, 50) : `cust${clean}`.slice(0, 50);
}

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function mapCashfreeOrderStatus(status?: string): TransactionStatus {
  switch (status) {
    case 'PAID':
      return 'SUCCESS';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'TERMINATED':
    case 'TERMINATION_REQUESTED':
      return 'CANCELLED';
    case 'ACTIVE':
      return 'ACTIVE';
    default:
      return 'CREATED';
  }
}

function mapCashfreePaymentStatus(status?: string, eventType?: string): TransactionStatus {
  if (status === 'SUCCESS' || eventType === 'PAYMENT_SUCCESS_WEBHOOK') return 'SUCCESS';
  if (status === 'FAILED' || eventType === 'PAYMENT_FAILED_WEBHOOK') return 'FAILED';
  if (status === 'USER_DROPPED' || eventType === 'PAYMENT_USER_DROPPED_WEBHOOK') return 'USER_DROPPED';
  return 'ACTIVE';
}

function getSingleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const paymentService = new PaymentService();
