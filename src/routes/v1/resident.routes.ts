import { Router } from 'express';
import type { Request, Response } from 'express';
import onboardingRoutes from '../../modules/onboarding/onboarding.routes';
import notificationRoutes from '../../modules/notification/notification.routes';
import familyRoutes from '../../modules/family/family.routes';
import noticeRoutes from '../../modules/notice/notice.routes';
import vendorRoutes from '../../modules/vendor/vendor.routes';
import domesticStaffRoutes from '../../modules/domestic-staff/domestic-staff.routes';
import communityPostRoutes from '../../modules/community-post/community-post.routes';
import vehicleRoutes from '../../modules/vehicle/vehicle.routes';
import documentRoutes from '../../modules/document/document.routes';
import pollRoutes from '../../modules/poll/poll.routes';
import amenityRoutes from '../../modules/amenity/amenity.routes';
import { prisma } from '../../utils/Client';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { clearCacheAfter } from '../../middlewares/cache.middleware';
import { submitPaymentSchema, trustedVisitorCreateSchema, idParams } from '../../schemas';
import { getUpiPayee } from '../../modules/settings/society-settings.service';
import { paymentSubmissionService } from '../../modules/billing/payment-submission.service';
import { AppError } from '../../utils/ResponseHandler';
import {
  fileComplaint,
  listViolations,
} from '../../modules/vehicle/parking-violation.controller';

const router = Router();

// Resident-specific endpoints
router.use('/onboarding', onboardingRoutes);       // /api/v1/resident/onboarding
router.use('/notifications', notificationRoutes);  // /api/v1/resident/notifications
router.use('/family', familyRoutes);               // /api/v1/resident/family

// Resident-facing aliases (frontend-expected paths)
router.use('/notices', noticeRoutes);              // /api/v1/resident/notices
router.use('/local-directory', vendorRoutes);      // /api/v1/resident/local-directory
router.use('/daily-help', domesticStaffRoutes);    // /api/v1/resident/daily-help

// New modules
router.use('/posts', communityPostRoutes);         // /api/v1/resident/posts
router.use('/vehicles', vehicleRoutes);            // /api/v1/resident/vehicles
router.use('/documents', documentRoutes);          // /api/v1/resident/documents
router.use('/polls', pollRoutes);                  // /api/v1/resident/polls
router.use('/amenities', amenityRoutes);           // /api/v1/resident/amenities

// Parking complaints (resident can report, not issue official violations)
router.post('/parking/complaints', authenticate, fileComplaint);
router.get('/parking/complaints', authenticate, listViolations);  // scoped to own complaints in controller

// Resident directory — approved, active residents of the caller's society.
// There is no per-user privacy/contact-sharing setting, so phone numbers are never returned.
router.get('/society/residents', authenticate, async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId;
    if (!societyId) {
      return res.status(403).json({ success: false, message: 'User must be assigned to a society' });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where = {
      societyId,
      isActive: true,
      flatId: { not: null },
      user: {
        isActive: true,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
    };

    const [memberships, total] = await Promise.all([
      prisma.userFlatMembership.findMany({
        where,
        select: {
          id: true,
          userId: true,
          residentType: true,
          isOwner: true,
          user: { select: { name: true, photoUrl: true, familyRole: true } },
          flat: { select: { id: true, flatNumber: true, block: { select: { name: true } } } },
        },
        orderBy: [{ flat: { block: { name: 'asc' } } }, { flat: { flatNumber: 'asc' } }, { user: { name: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userFlatMembership.count({ where }),
    ]);

    const residents = memberships.map((membership) => {
      const blockName = membership.flat?.block?.name ?? null;
      const role = membership.user.familyRole
        ? 'Family'
        : membership.residentType === 'TENANT'
          ? 'Tenant'
          : 'Owner';
      return {
        id: membership.id,
        userId: membership.userId,
        name: membership.user.name,
        photoUrl: membership.user.photoUrl,
        flatId: membership.flat?.id ?? null,
        flatNumber: membership.flat?.flatNumber ?? '',
        blockName,
        block: blockName,
        residentType: role,
      };
    });

    return res.status(200).json({
      success: true,
      data: residents,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch residents' });
  }
});

// Dues — flat-level invoices for the logged-in user.
// Admins can also be residents, so this route intentionally scopes by flatId
// instead of role.
router.get('/dues', authenticate, async (req: Request, res: Response) => {
  try {
    const { societyId, flatId } = req.user!;
    if (!societyId || !flatId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const dues = await prisma.invoice.findMany({
      where: { societyId, flatId },
      orderBy: { dueDate: 'asc' },
      include: {
        society: { select: { name: true } },
        flat: {
          select: {
            flatNumber: true,
            block: { select: { name: true } },
          },
        },
        lineItems: {
          select: { id: true, description: true, amount: true },
        },
      },
    });

    const submissions = await paymentSubmissionService.latestByInvoice(dues.map((d) => d.id));
    return res.status(200).json({
      success: true,
      data: dues.map((due) => ({ ...formatInvoiceDue(due), submission: submissions.get(due.id) ?? null })),
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch dues' });
  }
});

router.get('/dues/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { societyId, flatId } = req.user!;
    const dueId = req.params.id as string;
    if (!societyId || !flatId) {
      return res.status(404).json({ success: false, message: 'Due record not found' });
    }

    const due = await prisma.invoice.findFirst({
      where: { id: dueId, societyId, flatId },
      include: {
        society: { select: { name: true } },
        flat: {
          select: {
            flatNumber: true,
            block: { select: { name: true } },
          },
        },
        lineItems: {
          select: { id: true, description: true, amount: true },
        },
      },
    });

    if (!due) {
      return res.status(404).json({ success: false, message: 'Due record not found' });
    }

    const [payee, submissions] = await Promise.all([
      getUpiPayee(societyId),
      paymentSubmissionService.latestByInvoice([due.id]),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        ...formatInvoiceDue(due),
        // Where to pay (null until the society admin has set up a UPI ID) and what happened to the
        // resident's last "I paid" report for this due
        payment: { upi: payee, submission: submissions.get(due.id) ?? null },
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch due details' });
  }
});

// Resident reports a UPI payment with the reference number (UTR); an admin confirms it.
router.post(
  '/dues/:id/payment-submissions',
  authenticate,
  validate({ body: submitPaymentSchema }),
  clearCacheAfter(['billing:*']),
  async (req: Request, res: Response) => {
    try {
      const { id, societyId, flatId } = req.user!;
      if (!societyId || !flatId) throw new AppError('Due record not found', 404);
      const submission = await paymentSubmissionService.submit(
        { id, societyId, flatId },
        req.params.id as string,
        req.body.utr
      );
      return res.status(201).json({ success: true, message: 'Payment submitted. The admin will confirm it soon.', data: submission });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Failed to submit payment' });
    }
  }
);

// Society-level dues/reminders for the account itself. These are not resident
// invoice IDs and must not be sent to the invoice Cashfree endpoint.
router.get('/society-dues', authenticate, async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'User not assigned to a society' });
    }

    const dues = await prisma.paymentReminder.findMany({
      where: { societyId },
      orderBy: { dueDate: 'asc' },
    });

    return res.status(200).json({ success: true, data: dues });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch society dues' });
  }
});

function formatInvoiceDue(invoice: {
  id: string;
  societyId: string;
  flatId: string;
  month: string;
  amount: number;
  penalty: number;
  totalAmount: number;
  status: string;
  description: string | null;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
  society: { name: string };
  flat: { flatNumber: string; block: { name: string } | null };
  lineItems: Array<{ id: string; description: string; amount: number }>;
}) {
  return {
    id: invoice.id,
    societyId: invoice.societyId,
    flatId: invoice.flatId,
    month: invoice.month,
    amount: invoice.amount,
    penalty: invoice.penalty,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
    isPaid: invoice.status === 'PAID',
    description: invoice.description,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    societyName: invoice.society.name,
    flatNumber: invoice.flat.flatNumber,
    blockName: invoice.flat.block?.name ?? null,
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      label: item.description,
      description: item.description,
      amount: item.amount,
    })),
    createdAt: invoice.createdAt,
  };
}

export default router;

// Visitors this flat always lets in (tutor, relative...): they skip the approval prompt at the gate.
router.get('/trusted-visitors', authenticate, async (req: Request, res: Response) => {
  const { societyId, flatId } = req.user!;
  if (!societyId || !flatId) return res.json({ success: true, data: [] });
  const rows = await prisma.trustedVisitor.findMany({
    where: { societyId, flatId },
    select: { id: true, name: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ success: true, data: rows });
});

// "Always allow this visitor": created from a gate request of the resident's own flat
router.post('/trusted-visitors', authenticate, validate({ body: trustedVisitorCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { id, societyId, flatId } = req.user!;
    if (!societyId || !flatId) throw new AppError('No flat linked to your account', 400);
    const request = await prisma.entryRequest.findFirst({
      where: { id: req.body.entryRequestId, societyId, OR: [{ flatId }, { targets: { some: { flatId } } }] },
      select: { visitorName: true, visitorPhone: true, type: true },
    });
    if (!request) throw new AppError('Visit not found', 404);
    if (!request.visitorPhone) {
      throw new AppError('This visitor has no phone number, so they cannot be remembered', 400);
    }
    const row = await prisma.trustedVisitor.upsert({
      where: { flatId_phone: { flatId, phone: request.visitorPhone } },
      update: { name: request.visitorName || 'Visitor' },
      create: { name: request.visitorName || 'Visitor', phone: request.visitorPhone, flatId, societyId, createdById: id },
      select: { id: true, name: true, phone: true, createdAt: true },
    });
    return res.status(201).json({ success: true, message: 'They will be let in without asking.', data: row });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Failed to save visitor' });
  }
});

router.delete('/trusted-visitors/:id', authenticate, validate({ params: idParams }), async (req: Request, res: Response) => {
  const { societyId, flatId } = req.user!;
  if (!societyId || !flatId) return res.status(404).json({ success: false, message: 'Visitor not found' });
  const removed = await prisma.trustedVisitor.deleteMany({ where: { id: req.params.id as string, societyId, flatId } });
  if (removed.count === 0) return res.status(404).json({ success: false, message: 'Visitor not found' });
  return res.json({ success: true, message: 'Removed. They will need approval again.' });
});
