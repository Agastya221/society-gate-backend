import { prisma, TransactionClient } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { OnboardingStatus, OnboardingAction, ResidentType, DocumentType } from '../../../prisma/generated/prisma/client';
import type { Prisma } from '../../types';
import { eventBus } from '../../utils/eventBus';

export class OnboardingService {
  // ============================================
  // LIST SOCIETIES
  // ============================================
  async listSocieties(filters?: { city?: string; search?: string }) {
    const where: Prisma.SocietyWhereInput = {
      isActive: true,
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
      documents: Array<{
        type: DocumentType;
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
      }>;
    }
  ) {
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

      // Also check if flat has currentOwnerId set
      const flat = await prisma.flat.findUnique({
        where: { id: data.flatId },
      });

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

    // 4. Create onboarding request with documents
    const request = await prisma.$transaction(async (tx: TransactionClient) => {
      const onboardingRequest = await tx.onboardingRequest.create({
        data: {
          userId,
          societyId: data.societyId,
          blockId: data.blockId,
          flatId: data.flatId,
          residentType: data.residentType,
          status: 'PENDING_APPROVAL',
          submittedAt: new Date(),
          documents: {
            create: data.documents.map((doc) => ({
              documentType: doc.type,
              documentUrl: doc.url,
              fileName: doc.fileName,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
            })),
          },
        },
        include: {
          documents: true,
          society: true,
          block: true,
          flat: true,
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
          },
        },
      });

      return onboardingRequest;
    });

    return {
      requestId: request.id,
      status: request.status,
      submittedAt: request.submittedAt,
      estimatedReviewTime: '24-48 hours',
    };

    // Notify all admins of the society about the new onboarding request (non-blocking)
    setImmediate(() => {
      eventBus.emit('onboarding.submitted', {
        requestId: request.id,
        societyId: request.societyId,
        societyName: request.society.name,
        residentName: 'New Resident', // admin will see details in their dashboard
        residentPhone: '',
        flatNumber: request.flat?.flatNumber || '',
        blockName: request.block?.name || '',
        residentType: request.residentType,
        userId,
      });
    });
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
            fileName: true,
            uploadedAt: true,
            isVerified: true,
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
      submittedAt: request.submittedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      documents: request.documents,
      message: statusMessages[request.status],
      rejectionReason: request.rejectionReason,
      resubmitReason: request.resubmitReason,
      canReapply: request.status === 'REJECTED',
      accessGranted: request.status === 'APPROVED',
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

    return {
      id: request.id,
      resident: request.user,
      society: request.society.name,
      block: request.block.name,
      flat: request.flat.flatNumber,
      residentType: request.residentType,
      status: request.status,
      submittedAt: request.submittedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      rejectionReason: request.rejectionReason,
      resubmitReason: request.resubmitReason,
      resubmissionCount: request.resubmissionCount,
      documents: request.documents,
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

      const activeRole =
        request.user.role === 'SUPER_ADMIN'
          ? 'SUPER_ADMIN'
          : request.user.role === 'ADMIN' && request.user.societyId === request.societyId
            ? 'ADMIN'
            : 'RESIDENT';

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
            role: activeRole,
            residentType: request.residentType,
            isOwner: request.residentType === 'OWNER',
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
            role: activeRole,
            residentType: request.residentType,
            isOwner: request.residentType === 'OWNER',
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
      } else {
        updateData.currentTenantId = request.userId;
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
    documents: Array<{ type: DocumentType }>,
    residentType: 'OWNER' | 'TENANT'
  ) {
    if (documents.length === 0) {
      throw new AppError('At least one document is required', 400);
    }

    const documentTypes = documents.map((d) => d.type);

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
}
