import { prisma } from '../../utils/Client';
import logger from '../../utils/logger';
import { NotificationType } from '../../../prisma/generated/prisma/enums';
import { notificationService } from '../notification/notification.service';
import { societySettingsService } from '../settings/society-settings.service';
import { OCCUPIED_FLAT_WHERE } from '../onboarding/onboarding.service';
import { AppError } from '../../utils/ResponseHandler';
import { clampPagination } from '../../utils/scope';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Due day used only when neither the request nor Society Settings give one. */
export const FALLBACK_DUE_DAY = 10;

/**
 * Resolve the billing month to { year, monthIndex, label }. Accepts "April 2026",
 * "Apr 2026", "2026-04"; "next month" / "this month" / empty are resolved
 * relative to `now` (IST). Unparseable input → null.
 */
export function resolveBillingMonth(input: string | undefined, now: Date = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const build = (year: number, monthIndex: number) => ({
    year,
    monthIndex,
    label: `${MONTH_NAMES[monthIndex]} ${year}`,
  });
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw || raw === 'next month') {
    const m = ist.getUTCMonth() + 1;
    return build(ist.getUTCFullYear() + Math.floor(m / 12), m % 12);
  }
  if (raw === 'this month' || raw === 'current month') {
    return build(ist.getUTCFullYear(), ist.getUTCMonth());
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    const mi = Number(iso[2]) - 1;
    return mi >= 0 && mi < 12 ? build(Number(iso[1]), mi) : null;
  }
  const named = raw.match(/^([a-z]+)\s+(\d{4})$/);
  if (named) {
    const mi = MONTH_NAMES.findIndex((name) => name.toLowerCase().startsWith(named[1].slice(0, 3)) && named[1].length >= 3);
    return mi >= 0 ? build(Number(named[2]), mi) : null;
  }
  return null;
}

/** Midnight IST on `day` of the given month (day clamped to the month length). */
export function dueDateFor(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const d = Math.min(Math.max(1, Math.floor(day)), lastDay);
  return new Date(Date.UTC(year, monthIndex, d) - IST_OFFSET_MS);
}

/** An unpaid invoice is overdue once dueDate + grace days has passed. */
export function isPastGrace(dueDate: Date, graceDays: number, now: Date = new Date()): boolean {
  return dueDate.getTime() + Math.max(0, graceDays) * 24 * 60 * 60 * 1000 < now.getTime();
}

// ============================================
// BILLING SERVICE
// ============================================

export class BillingService {

  // -----------------------------------------------------------------------
  // 1. BULK INVOICE GENERATION
  //    Generates invoices for all OCCUPIED flats in the society.
  //    Skips any flat that already has an invoice for the given month.
  // -----------------------------------------------------------------------
  //    Amount / due date resolution (explicit request value wins, then Society
  //    Settings `maintenance`, then the legacy behaviour):
  //      amount  = amountPerFlat ?? settings.monthlyFee        (else 400)
  //      dueDate = dueDate ?? <dueDayOfMonth of billing month>  (settings, else day 10)
  async generateBulkInvoices(
    societyId: string,
    monthInput: string | undefined,
    amountInput: number | undefined,
    description: string,
    dueDateInput: Date | undefined,
  ) {
    const { maintenance } = await societySettingsService.getConfiguredRules(societyId);

    const amountPerFlat = amountInput ?? maintenance.monthlyFee ?? undefined;
    if (!amountPerFlat || amountPerFlat <= 0) {
      throw new AppError('Set a monthly maintenance fee in Society Settings or pass amountPerFlat', 400);
    }

    const resolvedMonth = resolveBillingMonth(monthInput);
    // Unrecognised month labels are kept verbatim (legacy behaviour) but then need an explicit dueDate
    const month = resolvedMonth?.label ?? (monthInput ?? '').trim();
    let dueDate = dueDateInput;
    if (!dueDate) {
      if (!resolvedMonth) {
        throw new AppError('Unrecognised month — use "April 2026" / "2026-04" or pass dueDate', 400);
      }
      dueDate = dueDateFor(
        resolvedMonth.year,
        resolvedMonth.monthIndex,
        maintenance.dueDayOfMonth ?? FALLBACK_DUE_DAY,
      );
    }

    // Really-occupied flats (owner/tenant/active membership — not the stale
    // isOccupied column) that don't already have an invoice this month
    const occupiedFlats = await prisma.flat.findMany({
      where: {
        societyId,
        isActive: true,
        ...OCCUPIED_FLAT_WHERE,
        // Exclude flats that already have an invoice for this month
        invoices: {
          none: { month, societyId },
        },
      },
      select: {
        id: true,
        flatNumber: true,
        block: { select: { name: true } },
      },
    });

    if (occupiedFlats.length === 0) {
      return {
        generated: 0,
        skipped: 0,
        month,
        amountPerFlat,
        dueDate,
        message: `All occupied flats already have invoices for ${month}`,
      };
    }

    // Bulk create invoices
    const invoiceData = occupiedFlats.map((flat) => ({
      month,
      amount: amountPerFlat,
      penalty: 0,
      totalAmount: amountPerFlat,
      description,
      dueDate,
      status: 'PENDING' as const,
      flatId: flat.id,
      societyId,
    }));

    const result = await prisma.invoice.createMany({
      data: invoiceData,
      skipDuplicates: true,
    });

    // Create base line-items for the invoices generated now (not ones that existed before)
    const createdInvoices = await prisma.invoice.findMany({
      where: { societyId, month, flatId: { in: occupiedFlats.map((f) => f.id) }, lineItems: { none: {} } },
      select: { id: true },
    });

    await prisma.invoiceLineItem.createMany({
      data: createdInvoices.map((inv) => ({
        invoiceId: inv.id,
        description,
        amount: amountPerFlat,
      })),
      skipDuplicates: true,
    });

    logger.info(
      { societyId, month, generated: result.count },
      '🧾 [BILLING] Bulk invoices generated',
    );

    return {
      generated: result.count,
      skipped: occupiedFlats.length - result.count,
      month,
      amountPerFlat,
      dueDate,
      message: `Generated ${result.count} invoice(s) for ${month}`,
    };
  }

  // -----------------------------------------------------------------------
  // 2. APPLY LATE PENALTY
  //    Finds all OVERDUE invoices and adds the penalty amount.
  //    Records a new line-item for transparency.
  // -----------------------------------------------------------------------
  async applyLatePenalty(societyId: string, penaltyAmount: number) {
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        societyId,
        status: 'OVERDUE',
      },
      select: { id: true, penalty: true, totalAmount: true, amount: true },
    });

    if (overdueInvoices.length === 0) {
      return {
        affected: 0,
        message: 'No overdue invoices found',
      };
    }

    // Update each overdue invoice's penalty and totalAmount
    await prisma.$transaction(
      overdueInvoices.map((inv) =>
        prisma.invoice.update({
          where: { id: inv.id },
          data: {
            penalty: inv.penalty + penaltyAmount,
            totalAmount: inv.totalAmount + penaltyAmount,
            lineItems: {
              create: {
                description: 'Late Payment Fee',
                amount: penaltyAmount,
              },
            },
          },
        }),
      ),
    );

    logger.info(
      { societyId, penaltyAmount, affected: overdueInvoices.length },
      '⚠️ [BILLING] Late penalties applied',
    );

    return {
      affected: overdueInvoices.length,
      message: `Applied ₹${penaltyAmount} penalty to ${overdueInvoices.length} overdue invoice(s)`,
    };
  }

  // -----------------------------------------------------------------------
  // 3. LIST ALL DUES
  //    Returns all invoices with flat, block, and primary resident info.
  // -----------------------------------------------------------------------
  async listDues(
    societyId: string,
    opts: {
      status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
      month?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, month } = opts;
    const { page, limit, skip } = clampPagination(opts.page, opts.limit, 50);

    const where: {
      societyId: string;
      status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
      month?: string;
    } = { societyId };
    if (status) where.status = status;
    if (month) where.month = month;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          flat: {
            select: {
              flatNumber: true,
              block: { select: { name: true } },
              residents: {
                where: { isPrimaryResident: true, isActive: true },
                select: { name: true, phone: true },
              },
            },
          },
          lineItems: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    // Mark invoices as OVERDUE once dueDate + Society Settings grace period has
    // passed and they're still PENDING (no grace configured → legacy: due date itself)
    const now = new Date();
    const { maintenance } = await societySettingsService.getConfiguredRules(societyId);
    const graceDays = maintenance.gracePeriodDays ?? 0;
    const overdueIds = invoices
      .filter((inv) => inv.status === 'PENDING' && isPastGrace(inv.dueDate, graceDays, now))
      .map((inv) => inv.id);

    if (overdueIds.length > 0) {
      await prisma.invoice.updateMany({
        where: { id: { in: overdueIds } },
        data: { status: 'OVERDUE' },
      });
      overdueIds.forEach((id) => {
        const inv = invoices.find((i) => i.id === id);
        if (inv) inv.status = 'OVERDUE';
      });
    }

    const formatted = invoices.map((inv) => ({
      id: inv.id,
      month: inv.month,
      amount: inv.amount,
      penalty: inv.penalty,
      totalAmount: inv.totalAmount,
      status: inv.status,
      description: inv.description,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      flatNumber: inv.flat.flatNumber,
      blockName: inv.flat.block?.name ?? null,
      residentName: inv.flat.residents[0]?.name ?? 'Unassigned',
      residentPhone: inv.flat.residents[0]?.phone ?? null,
      lineItems: inv.lineItems,
      createdAt: inv.createdAt,
    }));

    // Summary totals
    const summary = {
      totalCount: total,
      paidCount: formatted.filter((r) => r.status === 'PAID').length,
      pendingCount: formatted.filter((r) => r.status === 'PENDING').length,
      overdueCount: formatted.filter((r) => r.status === 'OVERDUE').length,
      waivedCount: formatted.filter((r) => r.status === 'WAIVED').length,
      collectedAmount: formatted.filter((r) => r.status === 'PAID').reduce((sum, r) => sum + r.totalAmount, 0),
      outstandingAmount: formatted
        .filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE')
        .reduce((sum, r) => sum + r.totalAmount, 0),
    };

    return {
      summary,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // -----------------------------------------------------------------------
  // 4. MARK INVOICE AS PAID
  // -----------------------------------------------------------------------
  async markAsPaid(invoiceId: string, societyId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'PAID') throw new Error('Invoice already paid');

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  // -----------------------------------------------------------------------
  // 5. WAIVE INVOICE
  // -----------------------------------------------------------------------
  async waiveInvoice(invoiceId: string, societyId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
    });

    if (!invoice) throw new Error('Invoice not found');

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'WAIVED' },
    });
  }

  // -----------------------------------------------------------------------
  // 6. SEND INVOICE REMINDER
  // -----------------------------------------------------------------------
  async sendInvoiceReminder(invoiceId: string, societyId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: {
        society: { select: { name: true } },
        flat: {
          select: {
            id: true,
            flatNumber: true,
            block: { select: { name: true } },
          },
        },
      },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'PAID') throw new Error('Invoice already paid');
    if (invoice.status === 'WAIVED') throw new Error('Invoice has been waived');

    const recipients = await prisma.user.findMany({
      where: {
        flatId: invoice.flatId,
        societyId,
        isActive: true,
        role: { in: ['RESIDENT', 'ADMIN'] },
      },
      select: { id: true },
    });

    const amountText = `₹${invoice.totalAmount.toLocaleString('en-IN')}`;
    const dueDateText = invoice.dueDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const flatLabel = `${invoice.flat.block?.name ? `${invoice.flat.block.name}-` : ''}${invoice.flat.flatNumber}`;

    const notifications = await Promise.all(
      recipients.map((recipient) =>
        notificationService.sendToUser(recipient.id, {
          type: NotificationType.SYSTEM,
          title: 'Payment Reminder',
          message: `${amountText} is pending for ${invoice.month}. Please pay by ${dueDateText}.`,
          referenceId: invoice.id,
          referenceType: 'Invoice',
          societyId,
          data: {
            invoiceId: invoice.id,
            month: invoice.month,
            totalAmount: invoice.totalAmount,
            dueDate: invoice.dueDate.toISOString(),
            status: invoice.status,
            flatId: invoice.flatId,
            flatNumber: invoice.flat.flatNumber,
            blockName: invoice.flat.block?.name ?? null,
            societyName: invoice.society.name,
          },
        }),
      ),
    );

    logger.info(
      { societyId, invoiceId, sent: notifications.length, flatId: invoice.flatId },
      '🔔 [BILLING] Invoice reminder sent',
    );

    return {
      invoiceId: invoice.id,
      sent: notifications.length,
      flat: flatLabel,
      message:
        notifications.length > 0
          ? `Reminder sent to ${notifications.length} account(s) for flat ${flatLabel}`
          : `No active resident account found for flat ${flatLabel}`,
    };
  }
}

export const billingService = new BillingService();
