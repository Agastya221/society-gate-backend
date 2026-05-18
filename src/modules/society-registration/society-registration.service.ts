import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import logger from '../../utils/logger';
import type { SubmitSocietyRegistrationDTO, SocietyRegistrationFilters } from '../../types';

export class SocietyRegistrationService {

  async submitRequest(_userId: string, _data: SubmitSocietyRegistrationDTO) {
    throw new AppError(
      'Society setup is handled by the S-Gate back office. Please search for an already activated society or contact S-Gate support to onboard your society.',
      403
    );
  }

  async getMyRequestStatus(userId: string) {
    const request = await prisma.societyRegistrationRequest.findFirst({
      where: { requestedById: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        society: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!request) {
      return { status: 'NOT_SUBMITTED', request: null };
    }

    return { status: request.status, request };
  }

  async listRequests(filters: SocietyRegistrationFilters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [requests, total] = await Promise.all([
      prisma.societyRegistrationRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { id: true, name: true, phone: true, email: true } },
          reviewedBy: { select: { id: true, name: true } },
          society: { select: { id: true, name: true, isActive: true } },
        },
      }),
      prisma.societyRegistrationRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRequestById(requestId: string) {
    const request = await prisma.societyRegistrationRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: {
          select: { id: true, name: true, phone: true, email: true, role: true },
        },
        reviewedBy: { select: { id: true, name: true } },
        society: true,
      },
    });

    if (!request) {
      throw new AppError('Society registration request not found', 404);
    }

    return request;
  }

  async approveRequest(requestId: string, reviewerId: string) {
    const request = await prisma.societyRegistrationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError('Society registration request not found', 404);
    }

    if (request.status !== 'PENDING') {
      throw new AppError(
        `Cannot approve a request with status: ${request.status}`,
        409
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const society = await tx.society.create({
        data: {
          name: request.societyName,
          address: request.address,
          city: request.city,
          state: request.state,
          pincode: request.pincode,
          contactName: request.contactName,
          contactPhone: request.contactPhone,
          contactEmail: request.contactEmail,
          totalFlats: request.totalFlats ?? undefined,
          monthlyFee: request.monthlyFee ?? undefined,
          isActive: true,
          nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      });

      const requestedBy = await tx.user.findUnique({
        where: { id: request.requestedById },
        select: { role: true, name: true, phone: true, email: true },
      });

      let adminFlatId: string | null = null;
      const shouldCreateAdminFlat =
        request.applicantIsMember &&
        !!request.adminBlockName?.trim() &&
        !!request.adminFlatNumber?.trim();

      if (shouldCreateAdminFlat) {
        const block = await tx.block.create({
          data: {
            societyId: society.id,
            name: request.adminBlockName!.trim(),
          },
        });

        const residentType = request.adminResidentType ?? 'OWNER';
        const flat = await tx.flat.create({
          data: {
            societyId: society.id,
            blockId: block.id,
            flatNumber: request.adminFlatNumber!.trim(),
            isOccupied: true,
            ownerName: request.contactName || requestedBy?.name || undefined,
            ownerPhone: request.contactPhone || requestedBy?.phone || undefined,
            ownerEmail: request.contactEmail || requestedBy?.email || undefined,
            currentOwnerId: residentType === 'OWNER' ? request.requestedById : undefined,
            currentTenantId: residentType === 'TENANT' ? request.requestedById : undefined,
          },
        });
        adminFlatId = flat.id;
      }

      const activeRole = requestedBy?.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

      const updatedUser = await tx.user.update({
        where: { id: request.requestedById },
        data: {
          role: activeRole,
          societyId: society.id,
          flatId: adminFlatId,
          isActive: true,
          isOwner: shouldCreateAdminFlat ? request.adminResidentType === 'OWNER' : false,
          isPrimaryResident: shouldCreateAdminFlat,
        },
        select: {
          id: true, name: true, phone: true,
          email: true, role: true, societyId: true, flatId: true,
        },
      });

      await tx.userFlatMembership.create({
        data: {
          userId: request.requestedById,
          societyId: society.id,
          flatId: adminFlatId,
          role: 'ADMIN',
          residentType: shouldCreateAdminFlat ? request.adminResidentType ?? 'OWNER' : undefined,
          isOwner: shouldCreateAdminFlat ? request.adminResidentType === 'OWNER' : false,
          isLivingHere: shouldCreateAdminFlat,
          isPrimary: shouldCreateAdminFlat,
          isActive: true,
          isDefault: true,
        },
      });

      const updatedRequest = await tx.societyRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          societyId: society.id,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });

      return { society, user: updatedUser, request: updatedRequest };
    });

    logger.info(
      `[SOCIETY_REG] Approved — requestId: ${requestId} | societyId: ${result.society.id} | newAdmin: ${result.user.id}`
    );

    return result;
  }

  async rejectRequest(requestId: string, reviewerId: string, rejectionReason: string) {
    const request = await prisma.societyRegistrationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError('Society registration request not found', 404);
    }

    if (request.status !== 'PENDING') {
      throw new AppError(
        `Cannot reject a request with status: ${request.status}`,
        409
      );
    }

    const updatedRequest = await prisma.societyRegistrationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionReason,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    logger.info(
      `[SOCIETY_REG] Rejected — requestId: ${requestId} | reason: ${rejectionReason}`
    );

    return updatedRequest;
  }
}
