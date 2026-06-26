import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { Prisma } from '../../../prisma/generated/prisma/client';
import type { AuthenticatedUser } from '../../types';

type PageQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

type SocietyQuery = PageQuery & {
  city?: string;
  isActive?: boolean;
  paymentStatus?: 'PENDING' | 'PAID' | 'OVERDUE';
  onboardingStatus?: string;
};

type UserQuery = PageQuery & {
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'GUARD' | 'RESIDENT';
  isActive?: boolean;
  societyId?: string;
};

type RequestQuery = PageQuery & {
  status?: string;
  societyId?: string;
};

type ActivityQuery = PageQuery & {
  action?: string;
  targetType?: string;
  actorUserId?: string;
};

type DateRangeQuery = {
  from?: string;
  to?: string;
  societyId?: string;
};

function pagination(query: PageQuery) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function pages(total: number, limit: number) {
  return Math.ceil(total / limit);
}

function dateRange(query: DateRangeQuery): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (query.from) range.gte = new Date(query.from);
  if (query.to) range.lte = new Date(query.to);
  return range.gte || range.lte ? range : undefined;
}

function countByKey<T extends Record<string, unknown>>(rows: Array<T & { _count: number }>, key: keyof T) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? 'UNKNOWN');
    acc[value] = row._count;
    return acc;
  }, {});
}

export class SuperAdminService {
  private async audit(actorId: string, action: string, targetType: string, targetId?: string, reason?: string, metadata?: Prisma.InputJsonValue) {
    await prisma.platformAuditLog.create({
      data: {
        actorUserId: actorId,
        action,
        targetType,
        targetId,
        reason,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }

  async getOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalSocieties,
      activeSocieties,
      inactiveSocieties,
      societiesByPayment,
      societiesByOnboarding,
      usersByRole,
      activeUsers,
      pendingSocietyRequests,
      pendingResidentRequests,
      todayEntries,
      openComplaints,
      activeEmergencies,
      platformRevenue,
      collectionSuccess,
      collectionPendingInvoices,
      failedTransactions,
    ] = await Promise.all([
      prisma.society.count(),
      prisma.society.count({ where: { isActive: true } }),
      prisma.society.count({ where: { isActive: false } }),
      prisma.society.groupBy({ by: ['paymentStatus'], _count: true }),
      prisma.society.groupBy({ by: ['onboardingStatus'], _count: true }),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.societyRegistrationRequest.count({ where: { status: 'PENDING' } }),
      prisma.onboardingRequest.count({ where: { status: { in: ['PENDING_APPROVAL', 'RESUBMIT_REQUESTED'] } } }),
      prisma.entry.count({ where: { checkInTime: { gte: today, lt: tomorrow } } }),
      prisma.complaint.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.emergency.count({ where: { status: 'ACTIVE' } }),
      prisma.society.aggregate({ where: { isActive: true }, _sum: { monthlyFee: true } }),
      prisma.paymentTransaction.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { totalAmount: true }, _count: true }),
      prisma.paymentTransaction.count({ where: { status: { in: ['FAILED', 'USER_DROPPED', 'EXPIRED', 'CANCELLED'] } } }),
    ]);

    return {
      societies: {
        total: totalSocieties,
        active: activeSocieties,
        inactive: inactiveSocieties,
        byPaymentStatus: countByKey(societiesByPayment, 'paymentStatus'),
        byOnboardingStatus: countByKey(societiesByOnboarding, 'onboardingStatus'),
      },
      users: {
        total: usersByRole.reduce((sum, row) => sum + row._count, 0),
        active: activeUsers,
        byRole: countByKey(usersByRole, 'role'),
      },
      approvals: {
        pendingSocietyRequests,
        pendingResidentRequests,
      },
      operations: {
        todayEntries,
        openComplaints,
        activeEmergencies,
      },
      sales: {
        monthlyRecurringRevenue: platformRevenue._sum.monthlyFee ?? 0,
      },
      collections: {
        successfulAmount: collectionSuccess._sum.amount ?? 0,
        successfulTransactions: collectionSuccess._count,
        pendingInvoiceAmount: collectionPendingInvoices._sum.totalAmount ?? 0,
        pendingInvoices: collectionPendingInvoices._count,
        failedTransactions,
      },
    };
  }

  async listSocieties(query: SocietyQuery) {
    const { page, limit, skip } = pagination(query);
    const where: Prisma.SocietyWhereInput = {};

    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.onboardingStatus) where.onboardingStatus = query.onboardingStatus as Prisma.EnumSocietyOnboardingStatusFilter;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { registeredName: { contains: query.search, mode: 'insensitive' } },
        { contactPhone: { contains: query.search } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [societies, total] = await Promise.all([
      prisma.society.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          registeredName: true,
          city: true,
          state: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          isActive: true,
          onboardingStatus: true,
          paymentStatus: true,
          monthlyFee: true,
          subscriptionCycle: true,
          lastPaidDate: true,
          nextDueDate: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              flats: true,
              blocks: true,
              invoices: true,
              complaints: true,
              emergencies: true,
            },
          },
        },
      }),
      prisma.society.count({ where }),
    ]);

    return { societies, pagination: { total, page, limit, pages: pages(total, limit) } };
  }

  async getSocietyById(id: string) {
    const society = await prisma.society.findUnique({
      where: { id },
      include: {
        blocks: { select: { id: true, name: true, isActive: true, _count: { select: { flats: true } } }, orderBy: { name: 'asc' } },
        users: { select: { id: true, name: true, phone: true, email: true, role: true, isActive: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        registrationRequest: true,
        _count: {
          select: {
            users: true,
            flats: true,
            flatMemberships: true,
            entries: true,
            invoices: true,
            complaints: true,
            emergencies: true,
            onboardingRequests: true,
          },
        },
      },
    });

    if (!society) throw new AppError('Society not found', 404);

    const [invoiceSummary, transactionSummary, openComplaints, activeEmergencies] = await Promise.all([
      prisma.invoice.groupBy({ where: { societyId: id }, by: ['status'], _count: true, _sum: { totalAmount: true } }),
      prisma.paymentTransaction.groupBy({ where: { invoice: { societyId: id } }, by: ['status'], _count: true, _sum: { amount: true } }),
      prisma.complaint.findMany({ where: { societyId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.emergency.findMany({ where: { societyId: id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return { society, billing: { invoices: invoiceSummary, transactions: transactionSummary }, openComplaints, activeEmergencies };
  }

  async setSocietyStatus(actor: AuthenticatedUser, societyId: string, data: { status?: string; isActive?: boolean; reason?: string }) {
    const existing = await prisma.society.findUnique({ where: { id: societyId }, select: { id: true, isActive: true, name: true } });
    if (!existing) throw new AppError('Society not found', 404);

    const status = data.status?.toUpperCase();
    const isActive = data.isActive ?? (status === 'ACTIVE' ? true : status === 'SUSPENDED' || status === 'DEACTIVATED' ? false : undefined);
    if (isActive === undefined) throw new AppError('Provide status ACTIVE/SUSPENDED/DEACTIVATED or isActive boolean', 400);
    if (!data.reason?.trim()) throw new AppError('Reason is required for society status changes', 400);

    const society = await prisma.society.update({ where: { id: societyId }, data: { isActive } });
    await this.audit(actor.id, isActive ? 'SOCIETY_ACTIVATED' : 'SOCIETY_SUSPENDED', 'Society', societyId, data.reason, { previousIsActive: existing.isActive, nextIsActive: isActive });
    return society;
  }

  async updateSociety(actor: AuthenticatedUser, societyId: string, data: Record<string, unknown> & { reason?: string }) {
    const existing = await prisma.society.findUnique({ where: { id: societyId }, select: { id: true } });
    if (!existing) throw new AppError('Society not found', 404);

    const allowedFields = [
      'name', 'registeredName', 'registrationNumber', 'address', 'city', 'state', 'pincode',
      'latitude', 'longitude', 'logoUrl', 'logoKey', 'contactName', 'contactPhone', 'contactEmail',
      'bankAccountNumber', 'bankIfsc', 'bankBranchName', 'panNumber', 'gstin', 'maintenanceBillingType',
      'maintenanceBillingConfig', 'totalFlats', 'monthlyFee', 'subscriptionCycle', 'lastPaidDate',
      'nextDueDate', 'paymentStatus', 'onboardingStatus', 'isActive',
    ];

    const updateData = allowedFields.reduce<Record<string, unknown>>((acc, field) => {
      if (data[field] !== undefined) acc[field] = data[field];
      return acc;
    }, {});

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No valid society fields provided for update', 400);
    }

    const society = await prisma.society.update({ where: { id: societyId }, data: updateData });
    await this.audit(actor.id, 'SOCIETY_UPDATED', 'Society', societyId, data.reason, updateData as Prisma.InputJsonValue);
    return society;
  }

  async listUsers(query: UserQuery) {
    const { page, limit, skip } = pagination(query);
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.societyId) {
      where.OR = [{ societyId: query.societyId }, { flatMemberships: { some: { societyId: query.societyId } } }];
    }
    if (query.search) {
      const searchOr: Prisma.UserWhereInput[] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
      where.AND = [{ OR: searchOr }];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          isActive: true,
          societyId: true,
          flatId: true,
          createdAt: true,
          lastLogin: true,
          society: { select: { id: true, name: true, city: true } },
          flat: { select: { id: true, flatNumber: true, block: { select: { name: true } } } },
          _count: { select: { flatMemberships: true, onboardingRequests: true, notifications: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, pagination: { total, page, limit, pages: pages(total, limit) } };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        society: { select: { id: true, name: true, city: true, isActive: true } },
        flat: { select: { id: true, flatNumber: true, block: { select: { id: true, name: true } } } },
        flatMemberships: {
          include: {
            society: { select: { id: true, name: true, city: true, isActive: true } },
            flat: { select: { id: true, flatNumber: true, block: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        onboardingRequests: {
          include: { society: { select: { id: true, name: true } }, flat: { select: { id: true, flatNumber: true } }, block: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async setUserStatus(actor: AuthenticatedUser, userId: string, data: { isActive: boolean; reason?: string }) {
    if (actor.id === userId && data.isActive === false) throw new AppError('Super Admin cannot disable their own account', 400);
    if (!data.reason?.trim()) throw new AppError('Reason is required for user status changes', 400);

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
    if (!existing) throw new AppError('User not found', 404);

    const user = await prisma.user.update({ where: { id: userId }, data: { isActive: data.isActive } });
    await this.audit(actor.id, data.isActive ? 'USER_ACTIVATED' : 'USER_DISABLED', 'User', userId, data.reason, { previousIsActive: existing.isActive, nextIsActive: data.isActive });
    return user;
  }

  async listOnboardingRequests(query: RequestQuery) {
    const { page, limit, skip } = pagination(query);
    const where: Prisma.OnboardingRequestWhereInput = {};
    if (query.status) where.status = query.status as Prisma.EnumOnboardingStatusFilter;
    if (query.societyId) where.societyId = query.societyId;
    if (query.search) {
      where.OR = [
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
        { user: { phone: { contains: query.search } } },
        { society: { name: { contains: query.search, mode: 'insensitive' } } },
        { flat: { flatNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.onboardingRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          society: { select: { id: true, name: true, city: true } },
          block: { select: { id: true, name: true } },
          flat: { select: { id: true, flatNumber: true } },
          documents: true,
        },
      }),
      prisma.onboardingRequest.count({ where }),
    ]);

    return { requests, pagination: { total, page, limit, pages: pages(total, limit) } };
  }

  async listSocietyRegistrationRequests(query: RequestQuery) {
    const { page, limit, skip } = pagination(query);
    const where: Prisma.SocietyRegistrationRequestWhereInput = {};
    if (query.status) where.status = query.status as Prisma.EnumSocietyRegistrationStatusFilter;
    if (query.search) {
      where.OR = [
        { societyName: { contains: query.search, mode: 'insensitive' } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
        { contactPhone: { contains: query.search } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.societyRegistrationRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          requestedBy: { select: { id: true, name: true, phone: true, email: true } },
          reviewedBy: { select: { id: true, name: true, phone: true } },
          society: { select: { id: true, name: true, isActive: true } },
        },
      }),
      prisma.societyRegistrationRequest.count({ where }),
    ]);

    return { requests, pagination: { total, page, limit, pages: pages(total, limit) } };
  }

  async getSales(query: DateRangeQuery) {
    const nextDueRange = dateRange(query);
    const where: Prisma.SocietyWhereInput = {};
    if (query.societyId) where.id = query.societyId;
    if (nextDueRange) where.nextDueDate = nextDueRange;

    const [byPaymentStatus, activeMrr, overdueValue, paidValue, upcomingDue] = await Promise.all([
      prisma.society.groupBy({ where, by: ['paymentStatus'], _count: true, _sum: { monthlyFee: true } }),
      prisma.society.aggregate({ where: { ...where, isActive: true }, _sum: { monthlyFee: true }, _count: true }),
      prisma.society.aggregate({ where: { ...where, paymentStatus: 'OVERDUE' }, _sum: { monthlyFee: true }, _count: true }),
      prisma.society.aggregate({ where: { ...where, paymentStatus: 'PAID' }, _sum: { monthlyFee: true }, _count: true }),
      prisma.society.findMany({ where: { ...where, paymentStatus: { in: ['PENDING', 'OVERDUE'] } }, orderBy: { nextDueDate: 'asc' }, take: 20, select: { id: true, name: true, city: true, monthlyFee: true, paymentStatus: true, nextDueDate: true, contactPhone: true } }),
    ]);

    return {
      platformRevenue: {
        activeSocieties: activeMrr._count,
        monthlyRecurringRevenue: activeMrr._sum.monthlyFee ?? 0,
        paidSocieties: paidValue._count,
        paidValue: paidValue._sum.monthlyFee ?? 0,
        overdueSocieties: overdueValue._count,
        overdueValue: overdueValue._sum.monthlyFee ?? 0,
        byPaymentStatus,
      },
      upcomingDue,
    };
  }

  async getCollections(query: DateRangeQuery) {
    const range = dateRange(query);
    const invoiceWhere: Prisma.InvoiceWhereInput = {};
    const transactionWhere: Prisma.PaymentTransactionWhereInput = {};
    if (query.societyId) {
      invoiceWhere.societyId = query.societyId;
      transactionWhere.invoice = { societyId: query.societyId };
    }
    if (range) {
      invoiceWhere.createdAt = range;
      transactionWhere.createdAt = range;
    }

    const [invoices, transactions, recentFailures, topSocieties] = await Promise.all([
      prisma.invoice.groupBy({ where: invoiceWhere, by: ['status'], _count: true, _sum: { totalAmount: true } }),
      prisma.paymentTransaction.groupBy({ where: transactionWhere, by: ['status'], _count: true, _sum: { amount: true } }),
      prisma.paymentTransaction.findMany({
        where: { ...transactionWhere, status: { in: ['FAILED', 'USER_DROPPED', 'EXPIRED', 'CANCELLED'] } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { invoice: { select: { id: true, month: true, society: { select: { id: true, name: true } }, flat: { select: { id: true, flatNumber: true } } } } },
      }),
      prisma.invoice.groupBy({ where: { ...invoiceWhere, status: 'PAID' }, by: ['societyId'], _sum: { totalAmount: true }, _count: true, orderBy: { _sum: { totalAmount: 'desc' } }, take: 10 }),
    ]);

    return { invoices, transactions, recentFailures, topSocieties };
  }

  async listActivity(query: ActivityQuery) {
    const { page, limit, skip } = pagination(query);
    const where: Prisma.PlatformAuditLogWhereInput = {};
    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { targetType: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [activity, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { actor: { select: { id: true, name: true, phone: true, email: true, role: true } } },
      }),
      prisma.platformAuditLog.count({ where }),
    ]);

    return { activity, pagination: { total, page, limit, pages: pages(total, limit) } };
  }
}


