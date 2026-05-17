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

    return res.status(200).json({ success: true, data: dues.map(formatInvoiceDue) });
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

    return res.status(200).json({ success: true, data: formatInvoiceDue(due) });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch due details' });
  }
});

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
