import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import logger from '../../utils/logger';
import type { SubmitSocietyRegistrationDTO, SocietyRegistrationFilters } from '../../types';

export class SocietyRegistrationService {

  async submitRequest(userId: string, data: SubmitSocietyRegistrationDTO) {
    const existing = await prisma.societyRegistrationRequest.findFirst({
      where: {
        requestedById: userId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existing) {
      throw new AppError(
        'You already have an active society registration request. Status: ' + existing.status,
        409
      );
    }

    const request = await prisma.societyRegistrationRequest.create({
      data: { requestedById: userId, ...data },
      include: {
        requestedBy: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    logger.info(`[SOCIETY_REG] Request submitted — id: ${request.id} | user: ${userId}`);
    return request;
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

      const updatedUser = await tx.user.update({
        where: { id: request.requestedById },
        data: {
          role: 'ADMIN',
          societyId: society.id,
          isActive: true,
        },
        select: {
          id: true, name: true, phone: true,
          email: true, role: true, societyId: true,
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
