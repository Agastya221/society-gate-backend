import type { Request, Response } from 'express';
import { prisma } from '../../utils/Client';
import type { Prisma } from '../../types';

type IntercomQuery = {
  societyId?: string;
  search?: string;
  page: number;
  limit: number;
  includeGuards: boolean;
  includeInactive: boolean;
};

type IntercomContact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  initials: string;
  contactType: 'RESIDENT' | 'SECURITY';
  role: 'RESIDENT' | 'GUARD';
  subtitle: string;
  flat: {
    id: string;
    flatNumber: string;
    blockName: string | null;
  } | null;
  isOwner: boolean | null;
  isPrimaryResident: boolean | null;
  isActive: boolean;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function resolveSocietyId(req: Request): { societyId?: string; error?: { status: number; message: string } } {
  const query = req.query as unknown as IntercomQuery;
  const requestedSocietyId = query.societyId;

  if (req.user!.role === 'SUPER_ADMIN') {
    const societyId = requestedSocietyId ?? req.user!.societyId ?? undefined;
    if (!societyId) {
      return {
        error: {
          status: 400,
          message: 'societyId query parameter is required for super admin users',
        },
      };
    }
    return { societyId };
  }

  if (!req.user!.societyId) {
    return {
      error: {
        status: 403,
        message: 'Admin must be assigned to a society',
      },
    };
  }

  if (requestedSocietyId && requestedSocietyId !== req.user!.societyId) {
    return {
      error: {
        status: 403,
        message: 'Access denied. You can only access contacts in your society.',
      },
    };
  }

  return { societyId: req.user!.societyId };
}

// GET /admin/intercom/contacts
export const getAdminIntercomContacts = async (req: Request, res: Response) => {
  try {
    const scoped = resolveSocietyId(req);
    if (scoped.error) {
      return res.status(scoped.error.status).json({
        success: false,
        message: scoped.error.message,
      });
    }

    const {
      search,
      page,
      limit,
      includeGuards,
      includeInactive,
    } = req.query as unknown as IntercomQuery;

    const societyId = scoped.societyId!;
    const normalizedSearch = search?.trim();
    const userStatusFilter = includeInactive ? {} : { isActive: true };

    const residentWhere: Prisma.UserWhereInput = {
      societyId,
      role: 'RESIDENT',
      phone: { not: '' },
      ...userStatusFilter,
    };

    const guardWhere: Prisma.UserWhereInput = {
      societyId,
      role: 'GUARD',
      phone: { not: '' },
      ...userStatusFilter,
    };

    if (normalizedSearch) {
      const searchFilter: Prisma.UserWhereInput[] = [
        { name: { contains: normalizedSearch, mode: 'insensitive' } },
        { phone: { contains: normalizedSearch } },
        { email: { contains: normalizedSearch, mode: 'insensitive' } },
        { flat: { flatNumber: { contains: normalizedSearch, mode: 'insensitive' } } },
        { flat: { block: { name: { contains: normalizedSearch, mode: 'insensitive' } } } },
      ];

      residentWhere.OR = searchFilter;
      guardWhere.OR = [
        { name: { contains: normalizedSearch, mode: 'insensitive' } },
        { phone: { contains: normalizedSearch } },
      ];
    }

    const [residents, guards] = await Promise.all([
      prisma.user.findMany({
        where: residentWhere,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          photoUrl: true,
          isOwner: true,
          isPrimaryResident: true,
          isActive: true,
          flat: {
            select: {
              id: true,
              flatNumber: true,
              block: { select: { name: true } },
            },
          },
        },
      }),
      includeGuards
        ? prisma.user.findMany({
            where: guardWhere,
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              photoUrl: true,
              isActive: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const residentContacts: IntercomContact[] = residents.map((resident) => {
      const blockName = resident.flat?.block?.name ?? null;
      const flatNumber = resident.flat?.flatNumber ?? null;
      const subtitle = flatNumber ? `Flat ${flatNumber}` : 'Resident';

      return {
        id: resident.id,
        name: resident.name || 'Resident',
        phone: resident.phone,
        email: resident.email,
        photoUrl: resident.photoUrl,
        initials: getInitials(resident.name || 'Resident'),
        contactType: 'RESIDENT',
        role: 'RESIDENT',
        subtitle,
        flat: resident.flat
          ? {
              id: resident.flat.id,
              flatNumber: resident.flat.flatNumber,
              blockName,
            }
          : null,
        isOwner: resident.isOwner,
        isPrimaryResident: resident.isPrimaryResident,
        isActive: resident.isActive,
      };
    });

    const guardContacts: IntercomContact[] = guards.map((guard) => ({
      id: guard.id,
      name: guard.name || 'Gate Security',
      phone: guard.phone,
      email: guard.email,
      photoUrl: guard.photoUrl,
      initials: getInitials(guard.name || 'Gate Security'),
      contactType: 'SECURITY',
      role: 'GUARD',
      subtitle: 'Security',
      flat: null,
      isOwner: null,
      isPrimaryResident: null,
      isActive: guard.isActive,
    }));

    const contacts = [...residentContacts, ...guardContacts].sort((a, b) => {
      if (a.contactType !== b.contactType) {
        return a.contactType === 'RESIDENT' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const total = contacts.length;
    const start = (page - 1) * limit;
    const paginatedContacts = contacts.slice(start, start + limit);

    return res.status(200).json({
      success: true,
      data: paginatedContacts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      meta: {
        societyId,
        residents: residentContacts.length,
        guards: guardContacts.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
