import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { prisma, TransactionClient } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import {
  generateS3Key,
  getPresignedUploadUrl,
  isValidFileType,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_PHOTO_TYPES,
} from '../../utils/s3';
import { inviteDeliveryService } from '../../services/invite-delivery.service';
import type { AuthenticatedUser } from '../../types';
import {
  Prisma,
  type FlatOccupancyStatus,
  type MaintenanceBillingType,
  type SocietyOnboardingDocumentType,
} from '../../../prisma/generated/prisma/client';

const IMPORT_HEADERS = [
  'Block',
  'Flat Number',
  'Floor',
  'Owner Name',
  'Owner Phone',
  'Tenant Name',
  'Tenant Phone',
  'Vehicle Numbers',
  'Occupancy Status',
  'Square Feet',
] as const;

type ImportRow = {
  block: string;
  flatNumber: string;
  floor?: string;
  ownerName?: string;
  ownerPhone?: string;
  tenantName?: string;
  tenantPhone?: string;
  vehicleNumbers: string[];
  occupancyStatus: FlatOccupancyStatus;
  squareFeet?: number;
  rowNumber: number;
};

type RawImportRow = Record<string, unknown> & { rowNumber?: number };

function nextDueDateFromCycle(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  return cleaned;
}

function isValidIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

function normalizeVehicle(vehicleNumber: string): string {
  return vehicleNumber.toUpperCase().replace(/\s/g, '');
}

function parseVehicles(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[,\n;|]+/)
    .map((item) => normalizeVehicle(item))
    .filter(Boolean);
}

function parseOccupancy(value: string): FlatOccupancyStatus {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!normalized || normalized === 'VACANT') return 'VACANT';
  if (normalized === 'OWNER_OCCUPIED' || normalized === 'OWNER') return 'OWNER_OCCUPIED';
  if (normalized === 'RENTED' || normalized === 'TENANT' || normalized === 'TENANTED') return 'RENTED';
  throw new AppError(`Invalid occupancy status: ${value}`, 400);
}

function headerKey(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class SocietyOnboardingService {
  private assertCanManage(user: AuthenticatedUser, societyId: string) {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'ADMIN' && user.societyId === societyId) return;
    throw new AppError('You can manage onboarding only for your society', 403);
  }

  private assertSuperAdmin(user: AuthenticatedUser) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new AppError('Only SUPER_ADMIN can perform this onboarding action', 403);
    }
  }

  async createLead(data: {
    name: string;
    registeredName?: string;
    registrationNumber?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    totalFlats?: number;
  }, user: AuthenticatedUser) {
    this.assertSuperAdmin(user);

    const society = await prisma.society.create({
      data: {
        name: trim(data.name),
        registeredName: trim(data.registeredName) || trim(data.name),
        registrationNumber: trim(data.registrationNumber) || undefined,
        address: trim(data.address),
        city: trim(data.city),
        state: trim(data.state),
        pincode: trim(data.pincode),
        latitude: data.latitude,
        longitude: data.longitude,
        contactName: trim(data.contactName),
        contactPhone: normalizePhone(trim(data.contactPhone)),
        contactEmail: trim(data.contactEmail) || undefined,
        totalFlats: data.totalFlats ?? 0,
        isActive: false,
        onboardingStatus: 'LEAD',
        nextDueDate: nextDueDateFromCycle(new Date()),
      },
    });

    return society;
  }

  async inviteAdmin(societyId: string, data: {
    name: string;
    phone: string;
    email?: string;
  }, user: AuthenticatedUser) {
    this.assertSuperAdmin(user);

    const society = await prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new AppError('Society not found', 404);

    const phone = normalizePhone(trim(data.phone));
    if (!isValidIndianPhone(phone)) throw new AppError('Invalid admin phone number', 400);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { phone } });
      if (existing?.societyId && existing.societyId !== societyId && existing.role !== 'SUPER_ADMIN') {
        throw new AppError('This phone is already linked to another society', 409);
      }

      const admin = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name: trim(data.name) || existing.name,
              email: trim(data.email) || existing.email,
              role: existing.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
              societyId,
              isActive: true,
            },
          })
        : await tx.user.create({
            data: {
              name: trim(data.name),
              phone,
              email: trim(data.email) || undefined,
              role: 'ADMIN',
              societyId,
              isActive: true,
            },
          });

      const existingMembership = await tx.userFlatMembership.findFirst({
        where: { userId: admin.id, societyId, role: 'ADMIN' },
      });

      if (existingMembership) {
        await tx.userFlatMembership.update({
          where: { id: existingMembership.id },
          data: { isActive: true, isDefault: true },
        });
      } else {
        await tx.userFlatMembership.create({
          data: {
            userId: admin.id,
            societyId,
            role: 'ADMIN',
            isActive: true,
            isDefault: true,
          },
        });
      }

      const updatedSociety = await tx.society.update({
        where: { id: societyId },
        data: {
          contactName: trim(data.name) || society.contactName,
          contactPhone: phone,
          contactEmail: trim(data.email) || society.contactEmail,
          onboardingStatus: society.onboardingStatus === 'LEAD' ? 'PROFILE_CREATED' : society.onboardingStatus,
        },
      });

      return { society: updatedSociety, admin };
    });

    return {
      ...result,
      invitation: {
        channel: 'WEB_DASHBOARD',
        phone,
        message: 'Admin can log in to the web dashboard using OTP.',
      },
    };
  }

  async getStatus(societyId: string, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      include: {
        onboardingDocuments: {
          orderBy: { createdAt: 'desc' },
        },
        importBatches: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { rowErrors: { orderBy: { rowNumber: 'asc' }, take: 20 } },
        },
        gatePoints: { include: { devices: true } },
        ruleConfig: true,
        _count: {
          select: {
            blocks: true,
            flats: true,
            users: true,
            vehicles: true,
          },
        },
      },
    });

    if (!society) throw new AppError('Society not found', 404);

    return society;
  }

  async updateBasicDetails(societyId: string, data: {
    name?: string;
    registeredName?: string;
    registrationNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number | null;
    longitude?: number | null;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string | null;
    totalFlats?: number;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    return prisma.society.update({
      where: { id: societyId },
      data: {
        name: data.name ? trim(data.name) : undefined,
        registeredName: data.registeredName ? trim(data.registeredName) : undefined,
        registrationNumber: data.registrationNumber ? trim(data.registrationNumber) : undefined,
        address: data.address ? trim(data.address) : undefined,
        city: data.city ? trim(data.city) : undefined,
        state: data.state ? trim(data.state) : undefined,
        pincode: data.pincode ? trim(data.pincode) : undefined,
        latitude: data.latitude === null ? null : data.latitude,
        longitude: data.longitude === null ? null : data.longitude,
        contactName: data.contactName ? trim(data.contactName) : undefined,
        contactPhone: data.contactPhone ? normalizePhone(trim(data.contactPhone)) : undefined,
        contactEmail: data.contactEmail === null ? null : data.contactEmail ? trim(data.contactEmail) : undefined,
        totalFlats: data.totalFlats,
        onboardingStatus: 'DOCS_PENDING',
      },
    });
  }

  async updateFinancialDetails(societyId: string, data: {
    bankAccountNumber?: string | null;
    bankIfsc?: string | null;
    bankBranchName?: string | null;
    panNumber?: string | null;
    gstin?: string | null;
    maintenanceBillingType?: MaintenanceBillingType;
    maintenanceBillingConfig?: Prisma.InputJsonValue | null;
    monthlyFee?: number;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    return prisma.society.update({
      where: { id: societyId },
      data: {
        bankAccountNumber: data.bankAccountNumber === null ? null : data.bankAccountNumber ? trim(data.bankAccountNumber) : undefined,
        bankIfsc: data.bankIfsc === null ? null : data.bankIfsc ? trim(data.bankIfsc).toUpperCase() : undefined,
        bankBranchName: data.bankBranchName === null ? null : data.bankBranchName ? trim(data.bankBranchName) : undefined,
        panNumber: data.panNumber === null ? null : data.panNumber ? trim(data.panNumber).toUpperCase() : undefined,
        gstin: data.gstin === null ? null : data.gstin ? trim(data.gstin).toUpperCase() : undefined,
        maintenanceBillingType: data.maintenanceBillingType,
        maintenanceBillingConfig: data.maintenanceBillingConfig === null ? Prisma.JsonNull : data.maintenanceBillingConfig,
        monthlyFee: data.monthlyFee,
      },
    });
  }

  async getDocumentUploadUrl(societyId: string, data: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    documentType?: SocietyOnboardingDocumentType;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    const allowedTypes =
      data.documentType === 'LOGO' ? ALLOWED_PHOTO_TYPES : ALLOWED_DOCUMENT_TYPES;
    if (!isValidFileType(data.mimeType, allowedTypes)) {
      throw new AppError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`, 400);
    }

    const maxSize = data.documentType === 'LOGO' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (data.fileSize > maxSize) {
      throw new AppError(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`, 400);
    }

    const s3Key = generateS3Key('general', user.id, data.fileName);
    return getPresignedUploadUrl(s3Key, data.mimeType);
  }

  async addDocument(societyId: string, data: {
    documentType: SocietyOnboardingDocumentType;
    fileUrl?: string;
    fileKey?: string;
    fileName: string;
    fileSizeMB?: number;
    fileType: string;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    if (!data.fileUrl && !data.fileKey) {
      throw new AppError('fileUrl or fileKey is required', 400);
    }

    const document = await prisma.societyOnboardingDocument.create({
      data: {
        societyId,
        documentType: data.documentType,
        fileUrl: data.fileUrl || data.fileKey!,
        fileKey: data.fileKey || data.fileUrl!,
        fileName: trim(data.fileName),
        fileSizeMB: data.fileSizeMB ?? 0,
        fileType: trim(data.fileType),
        uploadedById: user.id,
      },
    });

    if (data.documentType === 'LOGO') {
      await prisma.society.update({
        where: { id: societyId },
        data: {
          logoUrl: data.fileUrl || undefined,
          logoKey: data.fileKey || undefined,
        },
      });
    }

    await prisma.society.update({
      where: { id: societyId },
      data: { onboardingStatus: 'DOCS_PENDING' },
    });

    return document;
  }

  async submitVerification(societyId: string, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    const documents = await prisma.societyOnboardingDocument.findMany({
      where: { societyId },
      select: { documentType: true },
    });

    const docTypes = new Set(documents.map((doc) => doc.documentType));
    if (!docTypes.has('REGISTRATION_CERTIFICATE')) {
      throw new AppError('Society registration certificate is required', 400);
    }
    if (!docTypes.has('AUTHORIZED_SIGNATORY_ID')) {
      throw new AppError('Authorized signatory ID proof is required', 400);
    }

    return prisma.society.update({
      where: { id: societyId },
      data: { onboardingStatus: 'PENDING_VERIFICATION' },
    });
  }

  async approveVerification(societyId: string, reviewerId: string, notes?: string) {
    const society = await prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new AppError('Society not found', 404);
    if (society.onboardingStatus !== 'PENDING_VERIFICATION') {
      throw new AppError('Only societies pending verification can be approved', 409);
    }

    return prisma.$transaction(async (tx) => {
      await tx.societyOnboardingDocument.updateMany({
        where: { societyId, status: 'PENDING' },
        data: {
          status: 'VERIFIED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewerNotes: notes,
        },
      });

      return tx.society.update({
        where: { id: societyId },
        data: { onboardingStatus: 'IMPORT_PENDING' },
      });
    });
  }

  async rejectVerification(societyId: string, reviewerId: string, reason: string) {
    const society = await prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new AppError('Society not found', 404);

    return prisma.$transaction(async (tx) => {
      await tx.societyOnboardingDocument.updateMany({
        where: { societyId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewerNotes: reason,
        },
      });

      return tx.society.update({
        where: { id: societyId },
        data: { onboardingStatus: 'REJECTED', isActive: false },
      });
    });
  }

  getImportTemplateCsv() {
    return `${IMPORT_HEADERS.join(',')}\nTower A,A-101,1,Owner Name,9876543210,Tenant Name,9876543211,MH01AB1234;MH01AB5678,Rented,1200\n`;
  }

  async validateImport(societyId: string, data: {
    fileName?: string;
    fileContentBase64?: string;
    rows?: RawImportRow[];
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { onboardingStatus: true },
    });
    if (!society) throw new AppError('Society not found', 404);
    if (!['IMPORT_PENDING', 'CONFIG_PENDING'].includes(society.onboardingStatus)) {
      throw new AppError('Society must be verified before resident/unit import', 409);
    }

    const rawRows = data.rows?.length
      ? data.rows
      : await this.parseImportFile(data.fileName, data.fileContentBase64);

    const validation = await this.validateRows(societyId, rawRows);
    const status = validation.errors.length > 0 ? 'VALIDATION_FAILED' : 'VALIDATED';

    const batch = await prisma.societyImportBatch.create({
      data: {
        societyId,
        status,
        fileName: data.fileName,
        totalRows: rawRows.length,
        validRows: validation.validRows.length,
        errorRows: validation.errors.length,
        rawRows: validation.validRows as unknown as Prisma.InputJsonValue,
        summary: validation.summary as Prisma.InputJsonValue,
        uploadedById: user.id,
        rowErrors: {
          create: validation.errors.map((error) => ({
            rowNumber: error.rowNumber,
            field: error.field,
            message: error.message,
            rowData: error.rowData as Prisma.InputJsonValue,
          })),
        },
      },
      include: { rowErrors: { orderBy: { rowNumber: 'asc' } } },
    });

    if (status === 'VALIDATED') {
      await prisma.society.update({
        where: { id: societyId },
        data: { onboardingStatus: 'IMPORT_PENDING' },
      });
    }

    return batch;
  }

  async commitImport(societyId: string, batchId: string, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    const batch = await prisma.societyImportBatch.findFirst({
      where: { id: batchId, societyId },
      include: { rowErrors: true },
    });

    if (!batch) throw new AppError('Import batch not found', 404);
    if (batch.status === 'COMMITTED') throw new AppError('Import batch already committed', 409);
    if (batch.status !== 'VALIDATED' || batch.rowErrors.length > 0) {
      throw new AppError('Only a validated import batch without errors can be committed', 400);
    }

    const rows = Array.isArray(batch.rawRows) ? (batch.rawRows as unknown as ImportRow[]) : [];
    if (rows.length === 0) throw new AppError('Import batch has no rows to commit', 400);

    const summary = await prisma.$transaction(async (tx) => {
      const result = {
        blocksCreated: 0,
        flatsUpserted: 0,
        residentsUpserted: 0,
        membershipsUpserted: 0,
        vehiclesUpserted: 0,
      };

      for (const row of rows) {
        const block = await this.findOrCreateBlock(tx, societyId, row.block);
        if (block.created) result.blocksCreated += 1;

        const flat = await this.upsertFlat(tx, societyId, block.id, row);
        result.flatsUpserted += 1;

        let ownerId: string | null = null;
        let tenantId: string | null = null;

        if (row.ownerPhone) {
          const owner = await this.upsertResident(tx, societyId, flat.id, {
            name: row.ownerName || 'Owner',
            phone: row.ownerPhone,
            residentType: 'OWNER',
            isLivingHere: row.occupancyStatus === 'OWNER_OCCUPIED',
          });
          ownerId = owner.userId;
          result.residentsUpserted += owner.createdUser ? 1 : 0;
          result.membershipsUpserted += 1;
        }

        if (row.tenantPhone) {
          const tenant = await this.upsertResident(tx, societyId, flat.id, {
            name: row.tenantName || 'Tenant',
            phone: row.tenantPhone,
            residentType: 'TENANT',
            isLivingHere: true,
          });
          tenantId = tenant.userId;
          result.residentsUpserted += tenant.createdUser ? 1 : 0;
          result.membershipsUpserted += 1;
        }

        await tx.flat.update({
          where: { id: flat.id },
          data: {
            isOccupied: row.occupancyStatus !== 'VACANT',
            occupancyStatus: row.occupancyStatus,
            currentOwnerId: ownerId,
            currentTenantId: tenantId,
          },
        });

        const vehicleOwnerId = tenantId || ownerId;
        if (vehicleOwnerId) {
          for (const vehicleNumber of row.vehicleNumbers) {
            await tx.vehicle.upsert({
              where: { societyId_vehicleNumber: { societyId, vehicleNumber } },
              create: {
                societyId,
                flatId: flat.id,
                userId: vehicleOwnerId,
                vehicleNumber,
                vehicleType: 'Other',
                status: 'ACTIVE',
              },
              update: {
                flatId: flat.id,
                userId: vehicleOwnerId,
                status: 'ACTIVE',
                isActive: true,
              },
            });
            result.vehiclesUpserted += 1;
          }
        }
      }

      await tx.societyImportBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMMITTED',
          committedById: user.id,
          committedAt: new Date(),
          summary: result as Prisma.InputJsonValue,
        },
      });

      await tx.society.update({
        where: { id: societyId },
        data: {
          onboardingStatus: 'CONFIG_PENDING',
          totalFlats: await tx.flat.count({ where: { societyId, isActive: true } }),
        },
      });

      return result;
    });

    return { batchId, summary };
  }

  async updateRules(societyId: string, data: {
    deliveryCheckInRequired?: boolean;
    guestParkingHours?: number;
    visitorOtpRequired?: boolean;
    customRules?: Prisma.InputJsonValue | null;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    return prisma.societyRuleConfig.upsert({
      where: { societyId },
      create: {
        societyId,
        deliveryCheckInRequired: data.deliveryCheckInRequired ?? true,
        guestParkingHours: data.guestParkingHours ?? 4,
        visitorOtpRequired: data.visitorOtpRequired ?? true,
        customRules: data.customRules === null ? Prisma.JsonNull : data.customRules,
      },
      update: {
        deliveryCheckInRequired: data.deliveryCheckInRequired,
        guestParkingHours: data.guestParkingHours,
        visitorOtpRequired: data.visitorOtpRequired,
        customRules: data.customRules === null ? Prisma.JsonNull : data.customRules,
      },
    });
  }

  async updateBranding(societyId: string, data: {
    logoUrl?: string | null;
    logoKey?: string | null;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    return prisma.society.update({
      where: { id: societyId },
      data: {
        logoUrl: data.logoUrl === null ? null : data.logoUrl,
        logoKey: data.logoKey === null ? null : data.logoKey,
      },
    });
  }

  async configureGates(societyId: string, data: {
    gates: Array<{
      name: string;
      devices?: Array<{ deviceName: string; deviceIdentifier?: string }>;
    }>;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);
    if (!Array.isArray(data.gates) || data.gates.length === 0) {
      throw new AppError('At least one gate is required', 400);
    }

    return prisma.$transaction(async (tx) => {
      const gates = [];
      for (const gateInput of data.gates) {
        const gateName = trim(gateInput.name);
        if (!gateName) throw new AppError('Gate name is required', 400);

        let gate = await tx.gatePoint.findFirst({ where: { societyId, name: gateName } });
        gate = gate
          ? await tx.gatePoint.update({ where: { id: gate.id }, data: { isActive: true } })
          : await tx.gatePoint.create({ data: { societyId, name: gateName } });

        if (gateInput.devices?.length) {
          for (const device of gateInput.devices) {
            await tx.gateDevice.create({
              data: {
                societyId,
                gatePointId: gate.id,
                deviceName: trim(device.deviceName),
                deviceIdentifier: trim(device.deviceIdentifier) || undefined,
                createdById: user.id,
              },
            });
          }
        }

        gates.push(gate);
      }

      await tx.society.update({
        where: { id: societyId },
        data: { onboardingStatus: 'CONFIG_PENDING' },
      });

      return gates;
    });
  }

  async createGuards(societyId: string, data: {
    guards: Array<{ name: string; phone: string; photoUrl?: string }>;
  }, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);
    if (!Array.isArray(data.guards) || data.guards.length === 0) {
      throw new AppError('At least one guard is required', 400);
    }

    return prisma.$transaction(async (tx) => {
      const guards = [];
      for (const guardInput of data.guards) {
        const phone = normalizePhone(trim(guardInput.phone));
        if (!isValidIndianPhone(phone)) throw new AppError(`Invalid guard phone number: ${guardInput.phone}`, 400);

        const existing = await tx.user.findUnique({ where: { phone } });
        if (existing?.societyId && existing.societyId !== societyId) {
          throw new AppError(`Guard phone already belongs to another society: ${phone}`, 409);
        }

        const guard = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                name: trim(guardInput.name) || existing.name,
                photoUrl: guardInput.photoUrl ?? existing.photoUrl,
                role: 'GUARD',
                societyId,
                flatId: null,
                isActive: true,
              },
            })
          : await tx.user.create({
              data: {
                name: trim(guardInput.name),
                phone,
                photoUrl: guardInput.photoUrl,
                role: 'GUARD',
                societyId,
                isActive: true,
              },
            });

        const membership = await tx.userFlatMembership.findFirst({
          where: { userId: guard.id, societyId, role: 'GUARD' },
        });
        if (membership) {
          await tx.userFlatMembership.update({
            where: { id: membership.id },
            data: { isActive: true, isDefault: true },
          });
        } else {
          await tx.userFlatMembership.create({
            data: {
              userId: guard.id,
              societyId,
              role: 'GUARD',
              isActive: true,
              isDefault: true,
            },
          });
        }

        guards.push(guard);
      }

      return guards;
    });
  }

  async activateSociety(societyId: string, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    const [society, flatsCount, gatesCount, guardsCount, ruleConfig] = await Promise.all([
      prisma.society.findUnique({ where: { id: societyId } }),
      prisma.flat.count({ where: { societyId, isActive: true, block: { name: { not: 'Admin' } } } }),
      prisma.gatePoint.count({ where: { societyId, isActive: true } }),
      prisma.user.count({ where: { societyId, role: 'GUARD', isActive: true } }),
      prisma.societyRuleConfig.findUnique({ where: { societyId } }),
    ]);

    if (!society) throw new AppError('Society not found', 404);
    if (!['CONFIG_PENDING', 'IMPORT_PENDING', 'VERIFIED'].includes(society.onboardingStatus)) {
      throw new AppError('Society must be verified and configured before activation', 409);
    }
    if (flatsCount === 0) throw new AppError('At least one flat must be imported before activation', 400);
    if (gatesCount === 0) throw new AppError('At least one gate must be configured before activation', 400);
    if (guardsCount === 0) throw new AppError('At least one guard must be created before activation', 400);
    if (!ruleConfig) throw new AppError('Society rules must be configured before activation', 400);

    return prisma.society.update({
      where: { id: societyId },
      data: {
        isActive: true,
        onboardingStatus: 'ACTIVE',
      },
    });
  }

  async sendResidentInvites(societyId: string, user: AuthenticatedUser) {
    this.assertCanManage(user, societyId);

    const society = await prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new AppError('Society not found', 404);
    if (!society.isActive || society.onboardingStatus !== 'ACTIVE') {
      throw new AppError('Resident invites can be sent only after society activation', 400);
    }

    const residents = await prisma.user.findMany({
      where: {
        societyId,
        role: 'RESIDENT',
        isActive: true,
      },
      select: { id: true, name: true, phone: true, email: true },
    });

    if (residents.length > 0) {
      await prisma.notification.createMany({
        data: residents.map((resident) => ({
          userId: resident.id,
          societyId,
          type: 'SYSTEM',
          title: 'Welcome to S-Gate',
          message: `Your society ${society.name} is active. Log in with your registered phone number to access the resident app.`,
          data: {
            societyId,
            appDownloadLink: process.env.RESIDENT_APP_DOWNLOAD_URL ?? null,
          },
          referenceId: societyId,
          referenceType: 'Society',
        })),
      });
    }

    const appDownloadLink = process.env.RESIDENT_APP_DOWNLOAD_URL ?? null;
    const deliveryResults = await Promise.all(
      residents.map((resident) =>
        inviteDeliveryService.sendResidentInvite({
          phone: resident.phone,
          email: resident.email,
          name: resident.name,
          societyName: society.name,
          appDownloadLink,
        }),
      ),
    );

    const smsDelivered = deliveryResults.filter((result) => result.sms.delivered).length;
    const emailDelivered = deliveryResults.filter((result) => result.email.delivered).length;

    return {
      sent: residents.length,
      residents,
      channels: ['in_app', 'sms', 'email'],
      delivery: {
        inAppCreated: residents.length,
        smsDelivered,
        emailDelivered,
        smsConfigured: !!process.env.MSG91_RESIDENT_INVITE_TEMPLATE_ID,
        emailConfigured: !!process.env.EMAIL_INVITE_WEBHOOK_URL,
      },
      message: 'Resident invitations processed',
    };
  }

  private async parseImportFile(fileName?: string, fileContentBase64?: string): Promise<RawImportRow[]> {
    if (!fileName || !fileContentBase64) {
      throw new AppError('Either rows or fileName + fileContentBase64 is required', 400);
    }

    const buffer = Buffer.from(fileContentBase64, 'base64');
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.xlsx')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new AppError('Import file has no worksheet', 400);

      const headers: string[] = [];
      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = trim(cell.text || cell.value);
      });

      const rows: RawImportRow[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const item: RawImportRow = { rowNumber };
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) item[header] = trim(cell.text || cell.value);
        });
        if (Object.entries(item).some(([key, value]) => key !== 'rowNumber' && trim(value).length > 0)) {
          rows.push(item);
        }
      });
      return rows;
    }

    if (lowerName.endsWith('.csv')) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = await workbook.csv.read(Readable.from(buffer.toString('utf8')));
      const headers: string[] = [];
      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = trim(cell.text || cell.value);
      });

      const rows: RawImportRow[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const item: RawImportRow = { rowNumber };
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) item[header] = trim(cell.text || cell.value);
        });
        if (Object.entries(item).some(([key, value]) => key !== 'rowNumber' && trim(value).length > 0)) {
          rows.push(item);
        }
      });
      return rows;
    }

    throw new AppError('Only .xlsx and .csv import files are supported', 400);
  }

  private async validateRows(societyId: string, rawRows: RawImportRow[]) {
    const validRows: ImportRow[] = [];
    const errors: Array<{ rowNumber: number; field?: string; message: string; rowData: RawImportRow }> = [];
    const seenFlats = new Set<string>();
    const seenVehicles = new Set<string>();

    const existingVehicles = await prisma.vehicle.findMany({
      where: { societyId, isActive: true },
      select: { vehicleNumber: true },
    });
    const existingVehicleSet = new Set(existingVehicles.map((vehicle) => normalizeVehicle(vehicle.vehicleNumber)));

    rawRows.forEach((rawRow, index) => {
      const rowNumber = Number(rawRow.rowNumber || index + 2);
      const row = this.normalizeRawRow(rawRow);

      const rowErrors: Array<{ field?: string; message: string }> = [];

      if (!row.block) rowErrors.push({ field: 'Block', message: 'Block is required' });
      if (!row.flatNumber) rowErrors.push({ field: 'Flat Number', message: 'Flat Number is required' });

      const flatKey = row.flatNumber.toUpperCase();
      if (flatKey && seenFlats.has(flatKey)) {
        rowErrors.push({ field: 'Flat Number', message: 'Duplicate flat number in import file' });
      }
      if (flatKey) seenFlats.add(flatKey);

      if (row.ownerPhone && !isValidIndianPhone(row.ownerPhone)) {
        rowErrors.push({ field: 'Owner Phone', message: 'Owner phone is invalid' });
      }

      if (row.tenantPhone && !isValidIndianPhone(row.tenantPhone)) {
        rowErrors.push({ field: 'Tenant Phone', message: 'Tenant phone is invalid' });
      }

      if ((row.tenantName || row.occupancyStatus === 'RENTED') && !row.tenantPhone) {
        rowErrors.push({ field: 'Tenant Phone', message: 'Tenant phone is required for rented flats or tenant rows' });
      }

      if (!['OWNER_OCCUPIED', 'RENTED', 'VACANT'].includes(row.occupancyStatus)) {
        rowErrors.push({ field: 'Occupancy Status', message: 'Occupancy Status must be Owner Occupied, Rented, or Vacant' });
      }

      for (const vehicleNumber of row.vehicleNumbers) {
        if (seenVehicles.has(vehicleNumber)) {
          rowErrors.push({ field: 'Vehicle Numbers', message: `Duplicate vehicle in import file: ${vehicleNumber}` });
        }
        if (existingVehicleSet.has(vehicleNumber)) {
          rowErrors.push({ field: 'Vehicle Numbers', message: `Vehicle already exists in this society: ${vehicleNumber}` });
        }
        seenVehicles.add(vehicleNumber);
      }

      if (row.squareFeet !== undefined && row.squareFeet <= 0) {
        rowErrors.push({ field: 'Square Feet', message: 'Square Feet must be positive' });
      }

      if (rowErrors.length > 0) {
        rowErrors.forEach((error) => errors.push({ rowNumber, ...error, rowData: rawRow }));
        return;
      }

      validRows.push({ ...row, rowNumber });
    });

    return {
      validRows,
      errors,
      summary: {
        totalRows: rawRows.length,
        validRows: validRows.length,
        errorRows: errors.length,
      },
    };
  }

  private normalizeRawRow(rawRow: RawImportRow): Omit<ImportRow, 'rowNumber'> {
    const lookup = new Map<string, unknown>();
    Object.entries(rawRow).forEach(([key, value]) => {
      lookup.set(headerKey(key), value);
    });

    const get = (...keys: string[]) => {
      for (const key of keys) {
        const value = lookup.get(headerKey(key));
        if (value !== undefined) return trim(value);
      }
      return '';
    };

    const occupancyValue = get('Occupancy Status', 'Occupancy');
    let occupancyStatus: FlatOccupancyStatus = 'VACANT';
    try {
      occupancyStatus = parseOccupancy(occupancyValue);
    } catch {
      occupancyStatus = '__INVALID__' as FlatOccupancyStatus;
    }

    const squareFeetRaw = get('Square Feet', 'Sq Ft', 'Area');
    const squareFeet = squareFeetRaw ? Number(squareFeetRaw) : undefined;

    return {
      block: get('Block', 'Tower', 'Wing'),
      flatNumber: get('Flat Number', 'Flat', 'Unit Number', 'Unit'),
      floor: get('Floor') || undefined,
      ownerName: get('Owner Name') || undefined,
      ownerPhone: get('Owner Phone') ? normalizePhone(get('Owner Phone')) : undefined,
      tenantName: get('Tenant Name') || undefined,
      tenantPhone: get('Tenant Phone') ? normalizePhone(get('Tenant Phone')) : undefined,
      vehicleNumbers: parseVehicles(get('Vehicle Numbers', 'Vehicles')),
      occupancyStatus,
      squareFeet: Number.isFinite(squareFeet) ? squareFeet : undefined,
    };
  }

  private async findOrCreateBlock(tx: TransactionClient, societyId: string, blockName: string) {
    const existing = await tx.block.findUnique({
      where: { societyId_name: { societyId, name: blockName } },
    });
    if (existing) return { ...existing, created: false };

    const created = await tx.block.create({
      data: { societyId, name: blockName },
    });
    return { ...created, created: true };
  }

  private async upsertFlat(tx: TransactionClient, societyId: string, blockId: string, row: ImportRow) {
    return tx.flat.upsert({
      where: { societyId_flatNumber: { societyId, flatNumber: row.flatNumber } },
      create: {
        societyId,
        blockId,
        flatNumber: row.flatNumber,
        floor: row.floor,
        ownerName: row.ownerName,
        ownerPhone: row.ownerPhone,
        squareFeet: row.squareFeet,
        occupancyStatus: row.occupancyStatus,
        isOccupied: row.occupancyStatus !== 'VACANT',
      },
      update: {
        blockId,
        floor: row.floor,
        ownerName: row.ownerName,
        ownerPhone: row.ownerPhone,
        squareFeet: row.squareFeet,
        occupancyStatus: row.occupancyStatus,
        isOccupied: row.occupancyStatus !== 'VACANT',
        isActive: true,
      },
    });
  }

  private async upsertResident(tx: TransactionClient, societyId: string, flatId: string, data: {
    name: string;
    phone: string;
    residentType: 'OWNER' | 'TENANT';
    isLivingHere: boolean;
  }) {
    const existingUser = await tx.user.findUnique({ where: { phone: data.phone } });
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: existingUser.name || data.name,
            role: existingUser.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'RESIDENT',
            isActive: true,
            societyId: existingUser.societyId || societyId,
            flatId: existingUser.flatId || flatId,
            isOwner: existingUser.isOwner || data.residentType === 'OWNER',
          },
        })
      : await tx.user.create({
          data: {
            name: data.name,
            phone: data.phone,
            role: 'RESIDENT',
            isActive: true,
            societyId,
            flatId,
            isOwner: data.residentType === 'OWNER',
          },
        });

    const hasDefaultMembership = await tx.userFlatMembership.findFirst({
      where: { userId: user.id, isDefault: true, isActive: true },
      select: { id: true },
    });

    const existingMembership = await tx.userFlatMembership.findFirst({
      where: { userId: user.id, societyId, flatId },
    });

    if (existingMembership) {
      await tx.userFlatMembership.update({
        where: { id: existingMembership.id },
        data: {
          role: 'RESIDENT',
          residentType: data.residentType,
          isOwner: data.residentType === 'OWNER',
          isLivingHere: data.isLivingHere,
          isActive: true,
          isDefault: hasDefaultMembership ? existingMembership.isDefault : true,
        },
      });
    } else {
      await tx.userFlatMembership.create({
        data: {
          userId: user.id,
          societyId,
          flatId,
          role: 'RESIDENT',
          residentType: data.residentType,
          isOwner: data.residentType === 'OWNER',
          isLivingHere: data.isLivingHere,
          isActive: true,
          isDefault: !hasDefaultMembership,
        },
      });
    }

    return { userId: user.id, createdUser: !existingUser };
  }
}
