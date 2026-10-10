import { z } from 'zod';
import {
  MaintenanceBillingType,
  SocietyOnboardingDocumentType,
} from '../../../prisma/generated/prisma/enums';

// Strict allow-lists for society onboarding bodies (no raw req.body into Prisma).

const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => text(max).nullable().optional();
const phone = z.string().trim().min(10).max(15);
const jsonValue = z.unknown().refine((v) => JSON.stringify(v ?? null).length <= 20_000, 'Value too large');

export const createLeadSchema = z.object({
  name: text(200).min(1),
  registeredName: text(200).optional(),
  registrationNumber: text(100).optional(),
  address: text(500).min(1),
  city: text(100).min(1),
  state: text(100).min(1),
  pincode: text(10).min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactName: text(100).min(1),
  contactPhone: phone,
  contactEmail: z.string().trim().email().optional(),
  totalFlats: z.number().int().min(0).max(100_000).optional(),
}).strict();

export const inviteAdminSchema = z.object({
  name: text(100).min(1),
  phone,
  email: z.string().trim().email().optional(),
}).strict();

export const basicDetailsSchema = z.object({
  name: text(200).optional(),
  registeredName: text(200).optional(),
  registrationNumber: text(100).optional(),
  address: text(500).optional(),
  city: text(100).optional(),
  state: text(100).optional(),
  pincode: text(10).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  contactName: text(100).optional(),
  contactPhone: phone.optional(),
  contactEmail: z.string().trim().email().nullable().optional(),
  totalFlats: z.number().int().min(0).max(100_000).optional(),
}).strict();

export const financialDetailsSchema = z.object({
  bankAccountNumber: nullableText(34),
  bankIfsc: nullableText(11),
  bankBranchName: nullableText(200),
  panNumber: nullableText(10),
  gstin: nullableText(15),
  maintenanceBillingType: z.enum(MaintenanceBillingType).optional(),
  maintenanceBillingConfig: jsonValue.nullable().optional(),
  // Platform billing — only SUPER_ADMIN may set it (enforced in the service).
  monthlyFee: z.number().min(0).max(10_000_000).optional(),
}).strict();

export const documentUploadUrlSchema = z.object({
  fileName: text(255).min(1),
  mimeType: text(100).min(1),
  fileSize: z.coerce.number().int().positive(),
  documentType: z.enum(SocietyOnboardingDocumentType).optional(),
}).strict();

export const addDocumentSchema = z.object({
  documentType: z.enum(SocietyOnboardingDocumentType),
  fileKey: text(512).min(1),
  fileUrl: text(1024).optional(),
  fileName: text(255).min(1),
  fileSizeMB: z.number().min(0).max(15).optional(),
  fileType: text(100).min(1),
}).strict();

export const importSchema = z.object({
  fileName: text(255).optional(),
  fileContentBase64: z.string().max(15 * 1024 * 1024).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).max(5000).optional(),
}).strict();

export const rulesSchema = z.object({
  deliveryCheckInRequired: z.boolean().optional(),
  guestParkingHours: z.number().int().min(0).max(168).optional(),
  visitorOtpRequired: z.boolean().optional(),
  customRules: jsonValue.nullable().optional(),
}).strict();

export const brandingSchema = z.object({
  logoUrl: z.string().trim().url().max(1024).nullable().optional(),
  logoKey: text(512).nullable().optional(),
}).strict();

export const gatesSchema = z.object({
  gates: z.array(z.object({
    name: text(100).min(1),
    devices: z.array(z.object({
      deviceName: text(100).min(1),
      deviceIdentifier: text(200).optional(),
    }).strict()).max(20).optional(),
  }).strict()).min(1).max(50),
}).strict();

export const guardsSchema = z.object({
  guards: z.array(z.object({
    name: text(100).min(1),
    phone,
    photoUrl: z.string().trim().max(1024).optional(),
  }).strict()).min(1).max(50),
}).strict();
