import { prisma, TransactionClient } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { OnboardingStatus, OnboardingAction, ResidentType, DocumentType } from '../../../prisma/generated/prisma/client';
import type { Prisma } from '../../types';
import { eventBus } from '../../utils/eventBus';
import { getPresignedViewUrl } from '../../utils/s3';

export class OnboardingService {
  // ============================================
  // LIST SOCIETIES
  // ============================================
  async listSocieties(filters?: { city?: string; search?: string }) {
    const where: Prisma.SocietyWhereInput = {
      isActive: true,
      onboardingStatus: 'ACTIVE',
    };

    if (filters?.city) {
      where.city = filters.city;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const societies = await prisma.society.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        totalFlats: true,
        _count: {
          select: {
            blocks: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return societies.map((society) => ({
      ...society,
      totalBlocks: society._count.blocks,
      _count: undefined,
    }));
  }

  // ============================================
  // LIST BLOCKS
  // ============================================
  async listBlocks(societyId: string) {
    const blocks = await prisma.block.findMany({
      where: {
        societyId,
        isActive: true,
        name: { not: 'Admin' },
      },
      select: {
        id: true,
        name: true,
        totalFloors: true,
        description: true,
        _count: {
          select: {
            flats: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return blocks.map((block) => ({
      ...block,
      totalFlats: block._count.flats,
      _count: undefined,
    }));
  }

  // ============================================
  // LIST FLATS
  // ============================================
  async listFlats(societyId: string, blockId: string) {
    const flats = await prisma.flat.findMany({
      where: {
        societyId,
        blockId,
        isActive: true,
      },
      include: {
        block: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { flatNumber: 'asc' },
    });

    return flats.map((flat) => ({
      id: flat.id,
      flatNumber: flat.flatNumber,
      floor: flat.floor,
      blockName: flat.block?.name || '',
      isOccupied: flat.isOccupied,
      hasOwner: !!flat.currentOwnerId,
      hasTenant: !!flat.currentTenantId,
      ownerName: flat.ownerName,
      // Can apply as tenant even if owner exists
      // Can apply as owner only if no owner exists
      canApply: true,
    }));
  }

  // ============================================
  // SUBMIT ONBOARDING REQUEST
  // ============================================
  async submitOnboardingRequest(
    userId: string,
    data: {
      societyId: string;
      blockId: string;
      flatId: string;
      residentType: 'OWNER' | 'TENANT';
      isLivingHere?: boolean;
      documents: Array<{
        type: DocumentType;
        url?: string;
        s3Key?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      }>;
    }
  ) {
    const flat = await prisma.flat.findFirst({
      where: {
        id: data.flatId,
        societyId: data.societyId,
        blockId: data.blockId,
        isActive: true,
      },
    });

    if (!flat) {
      throw new AppError('Selected flat was not found in this society', 404);
    }

    const isLivingHere = data.residentType === 'OWNER'
      ? data.isLivingHere ?? true
      : true;

    // 1. Prevent duplicate active requests for the same flat.
    const existingRequest = await prisma.onboardingRequest.findFirst({
      where: {
        userId,
        societyId: data.societyId,
        flatId: data.flatId,
        status: {
          in: ['DRAFT', 'PENDING_DOCS', 'PENDING_APPROVAL', 'RESUBMIT_REQUESTED'],
        },
      },
    });

    if (existingRequest) {
      throw new AppError('You already have an active onboarding request for this flat', 400);
    }

    const existingMembership = await prisma.userFlatMembership.findFirst({
      where: {
        userId,
        societyId: data.societyId,
        flatId: data.flatId,
        isActive: true,
      },
    });

    if (existingMembership) {
      throw new AppError('You are already linked to this flat', 400);
    }

    // 2. Check if flat already has an owner (if applying as owner)
    if (data.residentType === 'OWNER') {
      const existingOwner = await prisma.onboardingRequest.findFirst({
        where: {
          flatId: data.flatId,
          residentType: 'OWNER',
          status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
        },
      });

      if (existingOwner) {
        throw new AppError('This flat already has an owner claim pending/approved', 400);
      }

      if (flat?.currentOwnerId) {
        throw new AppError('This flat already has an approved owner', 400);
      }

      const existingOwnerMembership = await prisma.userFlatMembership.findFirst({
        where: {
          flatId: data.flatId,
          isOwner: true,
          isActive: true,
        },
      });

      if (existingOwnerMembership) {
        throw new AppError('This flat already has an approved owner', 400);
      }
    }

    // 3. Validate documents
    this.validateDocuments(data.documents, data.residentType);

    let activeOwnerMembership: any = null;
    if (data.residentType === 'TENANT') {
      activeOwnerMembership = await prisma.userFlatMembership.findFirst({
        where: {
          flatId: data.flatId,
          isOwner: true,
          isActive: true,
        },
      });

      if (!activeOwnerMembership) {
        throw new AppError('Cannot apply as a tenant because this flat does not have an approved owner yet.', 400);
      }
    }

    // 4. Create onboarding request with documents
    const request = await prisma.$transaction(async (tx: TransactionClient) => {
      const onboardingRequest = await tx.onboardingRequest.create({
        data: {
          userId,
          societyId: data.societyId,
          blockId: data.blockId,
          flatId: data.flatId,
          residentType: data.residentType,
          isLivingHere,
          status: 'PENDING_APPROVAL',
          submittedAt: new Date(),
          documents: {
            create: data.documents.map((doc) => ({
              documentType: doc.type,
              documentUrl: doc.url ?? doc.s3Key ?? '',
              fileName: doc.fileName ?? doc.s3Key?.split('/').pop() ?? 'document',
              fileSize: doc.fileSize ?? 0,
              mimeType: doc.mimeType ?? 'application/octet-stream',
            })),
          },
        },
        include: {
          documents: true,
          society: true,
          block: true,
          flat: true,
          user: true,
        },
      });

      // Create audit log
      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: onboardingRequest.id,
          action: 'SUBMITTED_FOR_REVIEW',
          performedBy: userId,
          previousStatus: 'DRAFT',
          newStatus: 'PENDING_APPROVAL',
          metadata: {
            documentsCount: data.documents.length,
            isLivingHere,
          },
        },
      });

      return onboardingRequest;
    });

    const result = {
      requestId: request.id,
      status: request.status,
      submittedAt: request.submittedAt,
      estimatedReviewTime: '24-48 hours',
    };

    // Notify the flat owner or fall back to admins
    setImmediate(() => {
      if (data.residentType === 'TENANT' && activeOwnerMembership) {
        eventBus.emit('onboarding.submitted_to_owner', {
          requestId: request.id,
          ownerUserId: activeOwnerMembership.userId,
          societyId: request.societyId,
          flatId: request.flatId,
          tenantName: request.user.name || 'New Tenant',
          tenantPhone: request.user.phone,
          flatNumber: request.flat?.flatNumber || '',
          blockName: request.block?.name || '',
        });
      } else {
        eventBus.emit('onboarding.submitted', {
          requestId: request.id,
          societyId: request.societyId,
          societyName: request.society.name,
          residentName: 'New Resident', // admin will see details in their dashboard
          residentPhone: '',
          flatNumber: request.flat?.flatNumber || '',
          blockName: request.block?.name || '',
          residentType: request.residentType,
          isLivingHere: request.isLivingHere,
          userId,
        });
      }
    });

    return result;
  }

  // ============================================
  // GET ONBOARDING STATUS
  // ============================================
  async getOnboardingStatus(userId: string) {
    const request = await prisma.onboardingRequest.findFirst({
      where: { userId },
      include: {
        society: { select: { name: true } },
        block: { select: { name: true } },
        flat: { select: { flatNumber: true } },
        documents: {
          select: {
            id: true,
            documentType: true,
            documentUrl: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            isVerified: true,
            verifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      return {
        status: 'NOT_STARTED',
        message: 'Please complete your onboarding to access resident features',
      };
    }

    const documents = await this.mapDocumentsForResponse(request.documents);

    const statusMessages = {
      DRAFT: 'Please complete your profile and submit documents',
      PENDING_DOCS: 'Please upload required documents',
      PENDING_APPROVAL: 'Your request is under review by the society admin',
      RESUBMIT_REQUESTED: `Admin requested resubmission: ${request.resubmitReason}`,
      APPROVED: 'Welcome! Your account has been approved',
      REJECTED: `Your request was rejected: ${request.rejectionReason}`,
    };

    return {
      status: request.status,
      society: request.society.name,
      block: request.block.name,
      flat: request.flat.flatNumber,
      residentType: request.residentType,
      isLivingHere: request.isLivingHere,
      ownerOccupancy: request.residentType === 'OWNER'
        ? request.isLivingHere ? 'RESIDING_OWNER' : 'NON_RESIDING_OWNER'
        : null,
      submittedAt: request.submittedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      documents,
      message: statusMessages[request.status],
      rejectionReason: request.rejectionReason,
      resubmitReason: request.resubmitReason,
      canReapply: request.status === 'REJECTED',
      accessGranted: request.status === 'APPROVED',
    };
  }

  // ============================================
  // RESIDENT: GET ONE OF MY REQUESTS
  // ============================================
  async getMyRequestDetails(userId: string, requestId: string) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
      include: {
        society: { select: { id: true, name: true, city: true, address: true } },
        block: { select: { id: true, name: true } },
        flat: { select: { id: true, flatNumber: true, floor: true } },
        documents: {
          select: {
            id: true,
            documentType: true,
            documentUrl: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            isVerified: true,
            verifiedAt: true,
          },
          orderBy: { uploadedAt: 'asc' },
        },
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    const statusMessages = {
      DRAFT: 'Complete this application to send it for admin review.',
      PENDING_DOCS: 'Upload the required documents to continue.',
      PENDING_APPROVAL: 'Your request is under review by the society admin.',
      RESUBMIT_REQUESTED: request.resubmitReason
        ? `Admin requested resubmission: ${request.resubmitReason}`
        : 'Admin requested more information before approval.',
      APPROVED: 'This request has been approved.',
      REJECTED: request.rejectionReason
        ? `Rejected: ${request.rejectionReason}`
        : 'This request was rejected by the society admin.',
    };

    const documents = await this.mapDocumentsForResponse(request.documents);

    return {
      requestId: request.id,
      societyId: request.societyId,
      societyName: request.society.name,
      societyCity: request.society.city,
      societyAddress: request.society.address,
      blockId: request.blockId,
      blockName: request.block.name,
      flatId: request.flatId,
      flatNumber: request.flat.flatNumber,
      floor: request.flat.floor,
      label: [request.block.name, request.flat.flatNumber].filter(Boolean).join(' - '),
      subtitle: request.society.name,
      residentType: request.residentType,
      isLivingHere: request.isLivingHere,
      ownerOccupancy: request.residentType === 'OWNER'
        ? request.isLivingHere ? 'RESIDING_OWNER' : 'NON_RESIDING_OWNER'
        : null,
      status: request.status,
      message: statusMessages[request.status],
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      rejectionReason: request.rejectionReason,
      resubmitReason: request.resubmitReason,
      resubmissionCount: request.resubmissionCount,
      canSwitch: false,
      canDelete: request.status !== 'APPROVED',
      canReapply: request.status === 'REJECTED',
      canResubmit: request.status === 'RESUBMIT_REQUESTED',
      documents,
    };
  }

  // ============================================
  // RESIDENT: DELETE / WITHDRAW ONE OF MY REQUESTS
  // ============================================
  async deleteMyRequest(userId: string, requestId: string) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status === 'APPROVED') {
      throw new AppError('Approved flat memberships cannot be deleted from onboarding', 400);
    }

    await prisma.onboardingRequest.delete({
      where: { id: request.id },
    });

    return {
      requestId: request.id,
      status: request.status,
      deleted: true,
    };
  }

  // ============================================
  // RESIDENT: RESUBMIT CORRECTED DOCUMENTS
  // ============================================
  async resubmitMyRequest(
    userId: string,
    requestId: string,
    data: {
      residentType?: 'OWNER' | 'TENANT';
      isLivingHere?: boolean;
      documents: Array<{
        type: DocumentType;
        url?: string;
        s3Key?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      }>;
    }
  ) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
      include: {
        society: true,
        block: true,
        flat: true,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status !== 'RESUBMIT_REQUESTED') {
      throw new AppError('Only requests marked for resubmission can be resubmitted', 400);
    }

    if (data.residentType && data.residentType !== request.residentType) {
      throw new AppError('Resident type cannot be changed while resubmitting. Delete this request and apply again.', 400);
    }

    this.validateDocuments(data.documents, request.residentType);

    const isLivingHere = request.residentType === 'OWNER'
      ? data.isLivingHere ?? request.isLivingHere
      : true;

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.residentDocument.deleteMany({
        where: { onboardingRequestId: request.id },
      });

      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: request.id },
        data: {
          status: 'PENDING_APPROVAL',
          isLivingHere,
          submittedAt: new Date(),
          reviewedById: null,
          reviewedAt: null,
          rejectedAt: null,
          rejectionReason: null,
          resubmitReason: null,
          documents: {
            create: data.documents.map((doc) => ({
              documentType: doc.type,
              documentUrl: doc.url ?? doc.s3Key ?? '',
              fileName: doc.fileName ?? doc.s3Key?.split('/').pop() ?? 'document',
              fileSize: doc.fileSize ?? 0,
              mimeType: doc.mimeType ?? 'application/octet-stream',
            })),
          },
        },
        include: {
          documents: true,
        },
      });

      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: request.id,
          action: 'DOCUMENTS_RESUBMITTED',
          performedBy: userId,
          previousStatus: 'RESUBMIT_REQUESTED',
          newStatus: 'PENDING_APPROVAL',
          metadata: {
            documentsCount: data.documents.length,
            isLivingHere,
          },
        },
      });

      return updatedRequest;
    });

    setImmediate(() => {
      eventBus.emit('onboarding.submitted', {
        requestId: request.id,
        societyId: request.societyId,
        societyName: request.society.name,
        residentName: 'New Resident',
        residentPhone: '',
        flatNumber: request.flat?.flatNumber || '',
        blockName: request.block?.name || '',
        residentType: request.residentType,
        isLivingHere,
        userId,
      });
    });

    return {
      requestId: result.id,
      status: result.status,
      submittedAt: result.submittedAt,
      estimatedReviewTime: '24-48 hours',
    };
  }

  // ============================================
  // RESIDENT: REAPPLY / UPDATE AN EXISTING REQUEST
  // ============================================
  async reapplyMyRequest(
    userId: string,
    requestId: string,
    data: {
      societyId: string;
      blockId: string;
      flatId: string;
      residentType: 'OWNER' | 'TENANT';
      isLivingHere?: boolean;
      documents: Array<{
        type: DocumentType;
        url?: string;
        s3Key?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      }>;
    }
  ) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
      include: {
        society: true,
        block: true,
        flat: true,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    const allowedStatuses: OnboardingStatus[] = ['REJECTED', 'RESUBMIT_REQUESTED', 'DRAFT', 'PENDING_DOCS'];
    if (!allowedStatuses.includes(request.status)) {
      if (request.status === 'PENDING_APPROVAL') {
        throw new AppError('This request is already pending approval. Withdraw it before changing details.', 400);
      }
      throw new AppError('This onboarding request cannot be reapplied', 400);
    }

    const targetFlat = await prisma.flat.findFirst({
      where: {
        id: data.flatId,
        societyId: data.societyId,
        blockId: data.blockId,
        isActive: true,
      },
      include: {
        society: true,
        block: true,
      },
    });

    if (!targetFlat) {
      throw new AppError('Selected flat was not found in this society', 404);
    }

    const duplicateActiveRequest = await prisma.onboardingRequest.findFirst({
      where: {
        id: { not: request.id },
        userId,
        societyId: data.societyId,
        flatId: data.flatId,
        status: {
          in: ['DRAFT', 'PENDING_DOCS', 'PENDING_APPROVAL', 'RESUBMIT_REQUESTED'],
        },
      },
    });

    if (duplicateActiveRequest) {
      throw new AppError('You already have an active onboarding request for this flat', 400);
    }

    const existingMembership = await prisma.userFlatMembership.findFirst({
      where: {
        userId,
        societyId: data.societyId,
        flatId: data.flatId,
        isActive: true,
      },
    });

    if (existingMembership) {
      throw new AppError('You are already linked to this flat', 400);
    }

    if (data.residentType === 'OWNER') {
      const existingOwner = await prisma.onboardingRequest.findFirst({
        where: {
          id: { not: request.id },
          flatId: data.flatId,
          residentType: 'OWNER',
          status: { in: ['PENDING_APPROVAL', 'RESUBMIT_REQUESTED', 'APPROVED'] },
        },
      });

      if (existingOwner) {
        throw new AppError('This flat already has an owner claim pending/approved', 400);
      }

      if (targetFlat.currentOwnerId) {
        throw new AppError('This flat already has an approved owner', 400);
      }

      const existingOwnerMembership = await prisma.userFlatMembership.findFirst({
        where: {
          flatId: data.flatId,
          isOwner: true,
          isActive: true,
        },
      });

      if (existingOwnerMembership) {
        throw new AppError('This flat already has an approved owner', 400);
      }
    }

    this.validateDocuments(data.documents, data.residentType);

    const isLivingHere = data.residentType === 'OWNER'
      ? data.isLivingHere ?? true
      : true;
    const previousStatus = request.status;

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.residentDocument.deleteMany({
        where: { onboardingRequestId: request.id },
      });

      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: request.id },
        data: {
          societyId: data.societyId,
          blockId: data.blockId,
          flatId: data.flatId,
          residentType: data.residentType,
          isLivingHere,
          status: 'PENDING_APPROVAL',
          submittedAt: new Date(),
          approvedAt: null,
          rejectedAt: null,
          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,
          resubmitReason: null,
          documents: {
            create: data.documents.map((doc) => ({
              documentType: doc.type,
              documentUrl: doc.url ?? doc.s3Key ?? '',
              fileName: doc.fileName ?? doc.s3Key?.split('/').pop() ?? 'document',
              fileSize: doc.fileSize ?? 0,
              mimeType: doc.mimeType ?? 'application/octet-stream',
            })),
          },
        },
        include: {
          documents: true,
        },
      });

      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: request.id,
          action: previousStatus === 'RESUBMIT_REQUESTED'
            ? 'DOCUMENTS_RESUBMITTED'
            : 'SUBMITTED_FOR_REVIEW',
          performedBy: userId,
          previousStatus,
          newStatus: 'PENDING_APPROVAL',
          metadata: {
            documentsCount: data.documents.length,
            previousSocietyId: request.societyId,
            previousBlockId: request.blockId,
            previousFlatId: request.flatId,
            previousResidentType: request.residentType,
            isLivingHere,
          },
        },
      });

      return updatedRequest;
    });

    setImmediate(() => {
      eventBus.emit('onboarding.submitted', {
        requestId: request.id,
        societyId: data.societyId,
        societyName: targetFlat.society.name,
        residentName: 'New Resident',
        residentPhone: '',
        flatNumber: targetFlat.flatNumber || '',
        blockName: targetFlat.block?.name || '',
        residentType: data.residentType,
        isLivingHere,
        userId,
      });
    });

    return {
      requestId: result.id,
      status: result.status,
      submittedAt: result.submittedAt,
      estimatedReviewTime: '24-48 hours',
    };
  }

  // ============================================
  // ADMIN: LIST PENDING REQUESTS
  // ============================================
  async listPendingRequests(
    adminSocietyId: string,
    filters?: {
      status?: OnboardingStatus;
      residentType?: ResidentType;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OnboardingRequestWhereInput = {
      societyId: adminSocietyId,
    };

    if (filters?.status) {
      where.status = filters.status;
    } else {
      // Default to pending approval
      where.status = 'PENDING_APPROVAL';
    }

    if (filters?.residentType) {
      where.residentType = filters.residentType;
    }

    const [requests, total] = await Promise.all([
      prisma.onboardingRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              photoUrl: true,
            },
          },
          flat: {
            select: {
              flatNumber: true,
            },
          },
          block: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              documents: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.onboardingRequest.count({ where }),
    ]);

    return {
      requests: requests.map((req) => ({
        id: req.id,
        resident: req.user,
        flat: {
          flatNumber: req.flat.flatNumber,
          block: req.block.name,
        },
        residentType: req.residentType,
        isLivingHere: req.isLivingHere,
        ownerOccupancy: req.residentType === 'OWNER'
          ? req.isLivingHere ? 'RESIDING_OWNER' : 'NON_RESIDING_OWNER'
          : null,
        status: req.status,
        submittedAt: req.submittedAt,
        documentsCount: req._count.documents,
        resubmissionCount: req.resubmissionCount,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // ADMIN: GET REQUEST DETAILS
  // ============================================
  async getRequestDetails(requestId: string, adminSocietyId: string) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        societyId: adminSocietyId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            photoUrl: true,
          },
        },
        society: { select: { name: true } },
        block: { select: { name: true } },
        flat: { select: { flatNumber: true } },
        documents: true,
        auditLogs: {
          include: {
            performer: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    const documents = await this.mapDocumentsForResponse(request.documents);

    return {
      id: request.id,
      resident: request.user,
      society: request.society.name,
      block: request.block.name,
      flat: request.flat.flatNumber,
      residentType: request.residentType,
      isLivingHere: request.isLivingHere,
      ownerOccupancy: request.residentType === 'OWNER'
        ? request.isLivingHere ? 'RESIDING_OWNER' : 'NON_RESIDING_OWNER'
        : null,
      status: request.status,
      submittedAt: request.submittedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      rejectionReason: request.rejectionReason,
      resubmitReason: request.resubmitReason,
      resubmissionCount: request.resubmissionCount,
      documents,
      auditLog: request.auditLogs.map((log) => ({
        action: log.action,
        timestamp: log.createdAt,
        performedBy: log.performer.name,
        role: log.performer.role,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        notes: log.notes,
      })),
    };
  }

  // ============================================
  // ADMIN: APPROVE REQUEST
  // ============================================
  async approveRequest(requestId: string, adminId: string, adminSocietyId: string, notes?: string) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        societyId: adminSocietyId,
      },
      include: {
        user: true,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new AppError('Only pending requests can be approved', 400);
    }

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Update onboarding request
      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      // 2. Check if this is the first resident for this flat
      const existingResidents = await tx.userFlatMembership.count({
        where: {
          flatId: request.flatId,
          isActive: true,
          role: { in: ['RESIDENT', 'ADMIN', 'SUPER_ADMIN'] },
        },
      });

      if (existingResidents === 0) {
        const legacyResidents = await tx.user.count({
          where: {
            flatId: request.flatId,
            isActive: true,
          },
        });

        if (legacyResidents > 0) {
          await tx.userFlatMembership.createMany({
            data: await tx.user.findMany({
              where: {
                flatId: request.flatId,
                societyId: request.societyId,
                isActive: true,
              },
              select: {
                id: true,
                societyId: true,
                flatId: true,
                role: true,
                isOwner: true,
                isPrimaryResident: true,
              },
            }).then((users) =>
              users
                .filter((user) => user.societyId && user.flatId)
                .map((user) => ({
                  userId: user.id,
                  societyId: user.societyId!,
                  flatId: user.flatId!,
                  role: user.role,
                  residentType: user.isOwner ? 'OWNER' : 'TENANT',
                  isOwner: user.isOwner,
                  isLivingHere: true,
                  isPrimary: user.isPrimaryResident,
                  isActive: true,
                  isDefault: true,
                }))
            ),
            skipDuplicates: true,
          });
        }
      }

      const activeFlatMembers = await tx.userFlatMembership.count({
        where: {
          flatId: request.flatId,
          isActive: true,
        },
      });

      const isPrimaryResident = activeFlatMembers === 0;

      // 3. CRITICAL FIX: Validate owner constraint before approval
      if (request.residentType === 'OWNER') {
        const existingOwner = await tx.userFlatMembership.findFirst({
          where: {
            flatId: request.flatId,
            isOwner: true,
            isActive: true,
            userId: { not: request.userId },
          },
        });

        if (existingOwner) {
          throw new AppError('This flat already has an owner. Only one owner per flat is allowed.', 409);
        }
      }

      // A flat onboarding approval always creates resident access for that flat.
      // Society/admin access is granted only by society registration/admin assignment flows.
      const membershipRole = 'RESIDENT';
      const activeRole = request.user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : membershipRole;

      // 4. Update user
      await tx.user.update({
        where: { id: request.userId },
        data: {
          isActive: true,
          role: activeRole,
          societyId: request.societyId,
          flatId: request.flatId,
          isOwner: request.residentType === 'OWNER',
          isPrimaryResident, // Set as primary if first resident
        },
      });

      const existingFlatMembership = await tx.userFlatMembership.findFirst({
        where: {
          userId: request.userId,
          societyId: request.societyId,
          flatId: request.flatId,
        },
      });

      if (existingFlatMembership) {
        await tx.userFlatMembership.update({
          where: { id: existingFlatMembership.id },
          data: {
            role: membershipRole,
            residentType: request.residentType,
            isOwner: request.residentType === 'OWNER',
            isLivingHere: request.residentType === 'OWNER' ? request.isLivingHere : true,
            isPrimary: isPrimaryResident,
            isActive: true,
            isDefault: true,
          },
        });
      } else {
        await tx.userFlatMembership.create({
          data: {
            userId: request.userId,
            societyId: request.societyId,
            flatId: request.flatId,
            role: membershipRole,
            residentType: request.residentType,
            isOwner: request.residentType === 'OWNER',
            isLivingHere: request.residentType === 'OWNER' ? request.isLivingHere : true,
            isPrimary: isPrimaryResident,
            isActive: true,
            isDefault: true,
          },
        });
      }

      // 5. Update flat occupancy
      const updateData: Prisma.FlatUncheckedUpdateInput = {
        isOccupied: true,
      };

      if (request.residentType === 'OWNER') {
        updateData.currentOwnerId = request.userId;
        updateData.occupancyStatus = request.isLivingHere ? 'OWNER_OCCUPIED' : 'VACANT';
      } else {
        updateData.currentTenantId = request.userId;
        updateData.occupancyStatus = 'RENTED';
      }

      await tx.flat.update({
        where: { id: request.flatId },
        data: updateData,
      });

      // 6. Create audit log
      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: requestId,
          action: 'APPROVED',
          performedBy: adminId,
          previousStatus: 'PENDING_APPROVAL',
          newStatus: 'APPROVED',
          notes,
        },
      });

      return updatedRequest;
    });

    const result_data = {
      requestId: result.id,
      status: result.status,
      approvedAt: result.approvedAt,
      resident: {
        id: request.user.id,
        name: request.user.name,
        isActive: true,
        societyId: request.societyId,
        flatId: request.flatId,
      },
    };

    // Notify the resident their request was approved
    setImmediate(() => {
      eventBus.emit('onboarding.approved', {
        requestId: result.id,
        societyId: request.societyId,
        userId: request.user.id,
        residentName: request.user.name,
        flatId: request.flatId,
      });
    });

    return result_data;
  }

  // ============================================
  // ADMIN: REJECT REQUEST
  // ============================================
  async rejectRequest(
    requestId: string,
    adminId: string,
    adminSocietyId: string,
    reason: string
  ) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        societyId: adminSocietyId,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new AppError('Only pending requests can be rejected', 400);
    }

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: reason,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: requestId,
          action: 'REJECTED',
          performedBy: adminId,
          previousStatus: 'PENDING_APPROVAL',
          newStatus: 'REJECTED',
          notes: reason,
        },
      });

      return updatedRequest;
    });

    const result_data = {
      requestId: result.id,
      status: result.status,
      rejectedAt: result.rejectedAt,
      reason: result.rejectionReason,
    };

    // Notify resident their request was rejected
    setImmediate(() => {
      eventBus.emit('onboarding.rejected', {
        requestId: result.id,
        societyId: request.societyId,
        userId: request.userId,
        reason,
      });
    });

    return result_data;
  }

  // ============================================
  // ADMIN: REQUEST RESUBMISSION
  // ============================================
  async requestResubmission(
    requestId: string,
    adminId: string,
    adminSocietyId: string,
    reason: string,
    documentsToResubmit?: DocumentType[]
  ) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
        societyId: adminSocietyId,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new AppError('Only pending requests can request resubmission', 400);
    }

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: requestId },
        data: {
          status: 'RESUBMIT_REQUESTED',
          resubmitReason: reason,
          resubmissionCount: { increment: 1 },
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: requestId,
          action: 'RESUBMIT_REQUESTED',
          performedBy: adminId,
          previousStatus: 'PENDING_APPROVAL',
          newStatus: 'RESUBMIT_REQUESTED',
          notes: reason,
          metadata: {
            documentsToResubmit,
          },
        },
      });

      return updatedRequest;
    });

    setImmediate(() => {
      eventBus.emit('onboarding.resubmit_requested', {
        requestId: result.id,
        societyId: request.societyId,
        userId: request.userId,
        reason,
      });
    });

    return {
      requestId: result.id,
      status: result.status,
      reason: result.resubmitReason,
      documentsToResubmit,
    };
  }

  // ============================================
  // OWNER: LIST PENDING TENANT REQUESTS
  // ============================================
  async listOwnerPendingRequests(
    ownerId: string,
    pagination?: { page?: number; limit?: number }
  ) {
    const ownedMemberships = await prisma.userFlatMembership.findMany({
      where: {
        userId: ownerId,
        isOwner: true,
        isActive: true,
      },
      select: {
        flatId: true,
      },
    });

    const flatIds = ownedMemberships.map((m) => m.flatId).filter((id): id is string => !!id);
    if (flatIds.length === 0) {
      return {
        requests: [],
        pagination: {
          total: 0,
          page: pagination?.page || 1,
          limit: pagination?.limit || 20,
          pages: 0,
        },
      };
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;

    const where = {
      flatId: { in: flatIds },
      residentType: 'TENANT' as const,
      status: 'PENDING_APPROVAL' as const,
    };

    const [requests, total] = await Promise.all([
      prisma.onboardingRequest.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true, photoUrl: true } },
          flat: { include: { block: { select: { name: true } } } },
          documents: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.onboardingRequest.count({ where }),
    ]);

    const mappedRequests = await Promise.all(
      requests.map(async (req) => {
        const docs = await this.mapDocumentsForResponse(req.documents);
        return {
          requestId: req.id,
          resident: req.user,
          flatNumber: req.flat.flatNumber,
          blockName: req.flat.block?.name || '',
          residentType: req.residentType,
          submittedAt: req.submittedAt,
          documents: docs,
        };
      })
    );

    return {
      requests: mappedRequests,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // OWNER: APPROVE TENANT REQUEST
  // ============================================
  async ownerApproveRequest(requestId: string, ownerId: string, notes?: string) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
      },
      include: {
        user: true,
        flat: { include: { block: { select: { name: true } } } },
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new AppError('Only pending requests can be approved', 400);
    }

    // Verify caller owns the flat
    const ownerMembership = await prisma.userFlatMembership.findFirst({
      where: {
        userId: ownerId,
        flatId: request.flatId,
        isOwner: true,
        isActive: true,
      },
    });

    if (!ownerMembership) {
      throw new AppError('Access denied. You are not the owner of this flat.', 403);
    }

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Update onboarding request
      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          reviewedById: ownerId,
          reviewedAt: new Date(),
        },
      });

      const membershipRole = 'RESIDENT';

      // 2. Update user
      await tx.user.update({
        where: { id: request.userId },
        data: {
          isActive: true,
          role: membershipRole,
          societyId: request.societyId,
          flatId: request.flatId,
          isOwner: false,
          isPrimaryResident: false,
        },
      });

      const existingFlatMembership = await tx.userFlatMembership.findFirst({
        where: {
          userId: request.userId,
          societyId: request.societyId,
          flatId: request.flatId,
        },
      });

      if (existingFlatMembership) {
        await tx.userFlatMembership.update({
          where: { id: existingFlatMembership.id },
          data: {
            role: membershipRole,
            residentType: 'TENANT',
            isOwner: false,
            isLivingHere: true,
            isPrimary: false,
            isActive: true,
            isDefault: true,
          },
        });
      } else {
        await tx.userFlatMembership.create({
          data: {
            userId: request.userId,
            societyId: request.societyId,
            flatId: request.flatId,
            role: membershipRole,
            residentType: 'TENANT',
            isOwner: false,
            isLivingHere: true,
            isPrimary: false,
            isActive: true,
            isDefault: true,
          },
        });
      }

      // 3. Update flat occupancy
      await tx.flat.update({
        where: { id: request.flatId },
        data: {
          isOccupied: true,
          currentTenantId: request.userId,
          occupancyStatus: 'RENTED',
        },
      });

      // 4. Create audit log
      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: requestId,
          action: 'APPROVED',
          performedBy: ownerId,
          previousStatus: 'PENDING_APPROVAL',
          newStatus: 'APPROVED',
          notes,
        },
      });

      return updatedRequest;
    });

    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { name: true },
    });

    const result_data = {
      requestId: result.id,
      status: result.status,
      approvedAt: result.approvedAt,
      resident: {
        id: request.user.id,
        name: request.user.name,
        isActive: true,
        societyId: request.societyId,
        flatId: request.flatId,
      },
    };

    setImmediate(() => {
      eventBus.emit('onboarding.approved', {
        requestId: result.id,
        societyId: request.societyId,
        userId: request.user.id,
        residentName: request.user.name,
        flatId: request.flatId,
      });

      eventBus.emit('onboarding.tenant_approved_by_owner', {
        requestId: result.id,
        societyId: request.societyId,
        tenantName: request.user.name || 'New Tenant',
        blockName: request.flat.block?.name || '',
        flatNumber: request.flat.flatNumber,
        ownerName: owner?.name || 'Flat Owner',
        tenantId: request.userId,
        ownerId,
      });
    });

    return result_data;
  }

  // ============================================
  // OWNER: REJECT TENANT REQUEST
  // ============================================
  async ownerRejectRequest(requestId: string, ownerId: string, reason: string) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new AppError('Only pending requests can be rejected', 400);
    }

    const ownerMembership = await prisma.userFlatMembership.findFirst({
      where: {
        userId: ownerId,
        flatId: request.flatId,
        isOwner: true,
        isActive: true,
      },
    });

    if (!ownerMembership) {
      throw new AppError('Access denied. You are not the owner of this flat.', 403);
    }

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: reason,
          reviewedById: ownerId,
          reviewedAt: new Date(),
        },
      });

      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: requestId,
          action: 'REJECTED',
          performedBy: ownerId,
          previousStatus: 'PENDING_APPROVAL',
          newStatus: 'REJECTED',
          notes: reason,
        },
      });

      return updatedRequest;
    });

    setImmediate(() => {
      eventBus.emit('onboarding.rejected', {
        requestId: result.id,
        societyId: request.societyId,
        userId: request.userId,
        reason,
      });
    });

    return {
      requestId: result.id,
      status: result.status,
      rejectedAt: result.rejectedAt,
      reason: result.rejectionReason,
    };
  }

  // ============================================
  // OWNER: REQUEST DOCUMENT RESUBMISSION
  // ============================================
  async ownerRequestResubmission(
    requestId: string,
    ownerId: string,
    reason: string,
    documentsToResubmit?: DocumentType[]
  ) {
    const request = await prisma.onboardingRequest.findFirst({
      where: {
        id: requestId,
      },
    });

    if (!request) {
      throw new AppError('Onboarding request not found', 404);
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new AppError('Only pending requests can request resubmission', 400);
    }

    const ownerMembership = await prisma.userFlatMembership.findFirst({
      where: {
        userId: ownerId,
        flatId: request.flatId,
        isOwner: true,
        isActive: true,
      },
    });

    if (!ownerMembership) {
      throw new AppError('Access denied. You are not the owner of this flat.', 403);
    }

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const updatedRequest = await tx.onboardingRequest.update({
        where: { id: requestId },
        data: {
          status: 'RESUBMIT_REQUESTED',
          resubmitReason: reason,
          resubmissionCount: { increment: 1 },
          reviewedById: ownerId,
          reviewedAt: new Date(),
        },
      });

      await tx.onboardingAuditLog.create({
        data: {
          onboardingRequestId: requestId,
          action: 'RESUBMIT_REQUESTED',
          performedBy: ownerId,
          previousStatus: 'PENDING_APPROVAL',
          newStatus: 'RESUBMIT_REQUESTED',
          notes: reason,
          metadata: {
            documentsToResubmit,
          },
        },
      });

      return updatedRequest;
    });

    setImmediate(() => {
      eventBus.emit('onboarding.resubmit_requested', {
        requestId: result.id,
        societyId: request.societyId,
        userId: request.userId,
        reason,
      });
    });

    return {
      requestId: result.id,
      status: result.status,
      reason: result.resubmitReason,
      documentsToResubmit,
    };
  }

  // ============================================
  // HELPER: VALIDATE DOCUMENTS
  // ============================================
  private validateDocuments(
    documents: Array<{ type: DocumentType; url?: string; s3Key?: string }>,
    residentType: 'OWNER' | 'TENANT'
  ) {
    if (documents.length === 0) {
      throw new AppError('At least one document is required', 400);
    }

    const documentTypes = documents.map((d) => d.type);

    if (documents.some((doc) => !doc.url && !doc.s3Key)) {
      throw new AppError('Each document must include an uploaded file key', 400);
    }

    if (residentType === 'OWNER') {
      // Owner must have ownership proof
      if (!documentTypes.includes('OWNERSHIP_PROOF')) {
        throw new AppError('Ownership proof is required for owners', 400);
      }
    } else {
      // Tenant must have tenant agreement
      if (!documentTypes.includes('TENANT_AGREEMENT')) {
        throw new AppError('Tenant agreement is required for tenants', 400);
      }
    }

    // At least one ID proof required
    const idProofTypes = [
      'AADHAR_CARD',
      'PAN_CARD',
      'PASSPORT',
      'DRIVING_LICENSE',
      'VOTER_ID',
    ];
    const hasIdProof = documentTypes.some((type) => idProofTypes.includes(type));

    if (!hasIdProof) {
      throw new AppError('At least one ID proof is required', 400);
    }
  }

  private async mapDocumentsForResponse(
    documents: Array<{
      id: string;
      documentType: DocumentType;
      documentUrl: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      uploadedAt: Date;
      isVerified: boolean;
      verifiedAt?: Date | null;
    }>
  ) {
    return Promise.all(
      documents.map(async (doc) => {
        const storedUrl = doc.documentUrl;
        const isHttpUrl = /^https?:\/\//i.test(storedUrl);
        const viewUrl = isHttpUrl ? storedUrl : await getPresignedViewUrl(storedUrl);

        return {
          id: doc.id,
          documentType: doc.documentType,
          type: doc.documentType,
          documentUrl: viewUrl,
          url: viewUrl,
          viewUrl,
          fileKey: isHttpUrl ? null : storedUrl,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          uploadedAt: doc.uploadedAt,
          isVerified: doc.isVerified,
          verifiedAt: doc.verifiedAt ?? null,
        };
      })
    );
  }
}
