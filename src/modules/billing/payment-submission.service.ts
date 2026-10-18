import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { Prisma } from '../../../prisma/generated/prisma/client';
import { notificationService } from '../notification/notification.service';
import { pushService } from '../../services/push.service';
import logger from '../../utils/logger';

/**
 * Residents pay the society's UPI ID directly (no payment gateway), so the app cannot know whether
 * a payment went through. The resident submits the UPI reference number (UTR); an admin checks it
 * against the society's bank statement and confirms or rejects it. Only a confirmation marks the
 * invoice PAID.
 */

const OPEN_INVOICE_STATUSES = ['PENDING', 'OVERDUE'] as const;

const rupees = (amount: number) =>
  `₹${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

export const formatSubmission = (s: {
  id: string;
  status: string;
  utr: string;
  amount: number;
  rejectionReason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}) => ({
  id: s.id,
  status: s.status,
  utr: s.utr,
  amount: s.amount,
  rejectionReason: s.rejectionReason,
  submittedAt: s.createdAt,
  reviewedAt: s.reviewedAt,
});

class PaymentSubmissionService {
  /** The newest submission of each invoice (what the resident's due screen shows). */
  async latestByInvoice(invoiceIds: string[]) {
    if (invoiceIds.length === 0) return new Map<string, ReturnType<typeof formatSubmission>>();
    const rows = await prisma.paymentSubmission.findMany({
      where: { invoiceId: { in: invoiceIds } },
      orderBy: { createdAt: 'desc' },
    });
    const latest = new Map<string, ReturnType<typeof formatSubmission>>();
    for (const row of rows) {
      if (!latest.has(row.invoiceId)) latest.set(row.invoiceId, formatSubmission(row));
    }
    return latest;
  }

  async submit(
    user: { id: string; societyId: string; flatId: string },
    invoiceId: string,
    utr: string
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId: user.societyId, flatId: user.flatId },
      include: { flat: { select: { flatNumber: true, block: { select: { name: true } } } } },
    });
    if (!invoice) throw new AppError('Due record not found', 404);
    if (!(OPEN_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) {
      throw new AppError(
        invoice.status === 'PAID' ? 'This due is already paid' : 'This due does not need a payment',
        400
      );
    }

    const waiting = await prisma.paymentSubmission.findFirst({
      where: { invoiceId, status: 'SUBMITTED' },
      select: { id: true },
    });
    if (waiting) {
      throw new AppError('A payment for this due is already waiting for the admin to confirm', 409);
    }

    let submission;
    try {
      submission = await prisma.paymentSubmission.create({
        data: {
          invoiceId,
          societyId: user.societyId,
          flatId: user.flatId,
          submittedById: user.id,
          amount: invoice.totalAmount,
          utr,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'This reference number was already used. Check the number in your UPI app and try again.',
          409
        );
      }
      throw error;
    }

    const flatLabel = `${invoice.flat.block?.name ? `${invoice.flat.block.name} ` : ''}${invoice.flat.flatNumber}`;
    const title = 'Payment submitted';
    const body = `${flatLabel} paid ${rupees(invoice.totalAmount)} for ${invoice.month} (ref ${utr}). Please verify and confirm.`;
    const data = { type: 'PAYMENT_SUBMITTED', invoiceId, submissionId: submission.id };
    notificationService
      .sendToSocietyStaff(user.societyId, ['ADMIN'], {
        type: 'SYSTEM',
        title,
        message: body,
        data,
        referenceId: invoiceId,
        referenceType: 'Invoice',
        societyId: user.societyId,
      })
      .catch((error) => logger.error({ error }, 'Admin notification failed: payment submitted'));
    pushService
      .sendToSocietyStaff(user.societyId, ['ADMIN'], { title, body, data })
      .catch((error) => logger.error({ error }, 'Admin push failed: payment submitted'));

    return formatSubmission(submission);
  }

  async listForAdmin(societyId: string, status?: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED') {
    const rows = await prisma.paymentSubmission.findMany({
      where: { societyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: status === 'SUBMITTED' ? 'asc' : 'desc' },
      take: 100,
      include: {
        invoice: {
          select: {
            month: true,
            totalAmount: true,
            status: true,
            flat: { select: { flatNumber: true, block: { select: { name: true } } } },
          },
        },
      },
    });

    const people = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.submittedById))] } },
      select: { id: true, name: true, phone: true },
    });
    const byId = new Map(people.map((p) => [p.id, p]));

    return rows.map((row) => ({
      ...formatSubmission(row),
      invoiceId: row.invoiceId,
      month: row.invoice.month,
      invoiceStatus: row.invoice.status,
      flatNumber: row.invoice.flat.flatNumber,
      blockName: row.invoice.flat.block?.name ?? null,
      residentName: byId.get(row.submittedById)?.name ?? 'Resident',
      residentPhone: byId.get(row.submittedById)?.phone ?? null,
    }));
  }

  async confirm(societyId: string, adminId: string, submissionId: string) {
    const submission = await prisma.paymentSubmission.findFirst({
      where: { id: submissionId, societyId },
      include: { invoice: { select: { month: true, status: true } } },
    });
    if (!submission) throw new AppError('Payment submission not found', 404);
    if (submission.status !== 'SUBMITTED') {
      throw new AppError(`This payment was already ${submission.status.toLowerCase()}`, 400);
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const changed = await tx.paymentSubmission.updateMany({
        where: { id: submissionId, status: 'SUBMITTED' },
        data: { status: 'CONFIRMED', reviewedById: adminId, reviewedAt: now },
      });
      if (changed.count !== 1) throw new AppError('This payment was just handled by someone else', 409);
      // PAID unless an admin already settled the invoice another way
      await tx.invoice.updateMany({
        where: { id: submission.invoiceId, status: { in: [...OPEN_INVOICE_STATUSES] } },
        data: { status: 'PAID', paidAt: now },
      });
    });

    const title = 'Payment confirmed';
    const body = `Your payment of ${rupees(submission.amount)} for ${submission.invoice.month} was confirmed. Thank you!`;
    const data = { type: 'PAYMENT_CONFIRMED', invoiceId: submission.invoiceId };
    notificationService
      .sendToUser(submission.submittedById, {
        type: 'SYSTEM', title, message: body, data,
        referenceId: submission.invoiceId, referenceType: 'Invoice', societyId,
      })
      .catch((error) => logger.error({ error }, 'Notification failed: payment confirmed'));
    pushService
      .sendToUser(submission.submittedById, { title, body, data })
      .catch((error) => logger.error({ error }, 'Push failed: payment confirmed'));

    return { id: submissionId, status: 'CONFIRMED' as const };
  }

  async reject(societyId: string, adminId: string, submissionId: string, reason: string) {
    const submission = await prisma.paymentSubmission.findFirst({
      where: { id: submissionId, societyId },
      include: { invoice: { select: { month: true } } },
    });
    if (!submission) throw new AppError('Payment submission not found', 404);
    if (submission.status !== 'SUBMITTED') {
      throw new AppError(`This payment was already ${submission.status.toLowerCase()}`, 400);
    }

    const changed = await prisma.paymentSubmission.updateMany({
      where: { id: submissionId, status: 'SUBMITTED' },
      data: { status: 'REJECTED', rejectionReason: reason, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (changed.count !== 1) throw new AppError('This payment was just handled by someone else', 409);

    const title = 'Payment could not be verified';
    const body = `Your payment for ${submission.invoice.month} was not confirmed: ${reason}. Please check the reference number and submit again.`;
    const data = { type: 'PAYMENT_REJECTED', invoiceId: submission.invoiceId };
    notificationService
      .sendToUser(submission.submittedById, {
        type: 'SYSTEM', title, message: body, data,
        referenceId: submission.invoiceId, referenceType: 'Invoice', societyId,
      })
      .catch((error) => logger.error({ error }, 'Notification failed: payment rejected'));
    pushService
      .sendToUser(submission.submittedById, { title, body, data })
      .catch((error) => logger.error({ error }, 'Push failed: payment rejected'));

    return { id: submissionId, status: 'REJECTED' as const };
  }
}

export const paymentSubmissionService = new PaymentSubmissionService();
