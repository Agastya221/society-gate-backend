import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { Prisma } from '../../../prisma/generated/prisma/client';

// ============================================
// SOCIETY SETTINGS (Admin app → Society Settings screen)
// GET/PATCH /api/v1/admin/society/settings
// Stored in SocietyRuleConfig.customRules (no schema change) under the keys
// `maintenance` and `autoApproval`. Other customRules keys are preserved.
// ============================================

export interface MaintenanceSettings {
  monthlyFee: number | null;
  dueDayOfMonth: number;
  gracePeriodDays: number;
}

export interface AutoApprovalSettings {
  domesticStaff: boolean;
  delivery: boolean;
  cab: boolean;
}

export interface PaymentSettings {
  /** The society's UPI ID residents pay dues to (null = not set up yet) */
  upiId: string | null;
  /** Name shown in the resident's UPI app; falls back to the society name */
  payeeName: string | null;
}

export interface UpdateSocietySettingsDTO {
  maintenance?: Partial<{ monthlyFee: number; dueDayOfMonth: number; gracePeriodDays: number }>;
  autoApproval?: Partial<AutoApprovalSettings>;
  payments?: Partial<PaymentSettings>;
}

const DEFAULT_MAINTENANCE: MaintenanceSettings = {
  monthlyFee: null,
  dueDayOfMonth: 10,
  gracePeriodDays: 5,
};

const DEFAULT_AUTO_APPROVAL: AutoApprovalSettings = {
  domesticStaff: false,
  delivery: false,
  cab: false,
};

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};

const numberOr = <T extends number | null>(value: unknown, fallback: T): number | T =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const booleanOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

export class SocietySettingsService {
  /**
   * Raw values the admin actually saved (null = not set), for consumers that
   * must fall back to their own behaviour when a setting was never configured.
   */
  async getConfiguredRules(societyId: string): Promise<{
    maintenance: { monthlyFee: number | null; dueDayOfMonth: number | null; gracePeriodDays: number | null };
    autoApproval: AutoApprovalSettings;
  }> {
    const config = await prisma.societyRuleConfig.findUnique({
      where: { societyId },
      select: { customRules: true },
    });
    const rules = asObject(config?.customRules);
    const maintenance = asObject(rules.maintenance);
    const autoApproval = asObject(rules.autoApproval);
    return {
      maintenance: {
        monthlyFee: numberOr(maintenance.monthlyFee, null),
        dueDayOfMonth: numberOr(maintenance.dueDayOfMonth, null),
        gracePeriodDays: numberOr(maintenance.gracePeriodDays, null),
      },
      autoApproval: {
        domesticStaff: booleanOr(autoApproval.domesticStaff, DEFAULT_AUTO_APPROVAL.domesticStaff),
        delivery: booleanOr(autoApproval.delivery, DEFAULT_AUTO_APPROVAL.delivery),
        cab: booleanOr(autoApproval.cab, DEFAULT_AUTO_APPROVAL.cab),
      },
    };
  }

  async getSettings(societyId: string) {
    const [society, config] = await Promise.all([
      prisma.society.findUnique({
        where: { id: societyId },
        select: { name: true, address: true, city: true },
      }),
      prisma.societyRuleConfig.findUnique({
        where: { societyId },
        select: { customRules: true },
      }),
    ]);

    if (!society) {
      throw new AppError('Society not found', 404);
    }

    return this.format(society, config?.customRules);
  }

  async updateSettings(societyId: string, data: UpdateSocietySettingsDTO) {
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, address: true, city: true },
    });

    if (!society) {
      throw new AppError('Society not found', 404);
    }

    const existing = await prisma.societyRuleConfig.findUnique({
      where: { societyId },
      select: { customRules: true },
    });

    // Merge the partial update into whatever is stored (keeps unrelated customRules keys)
    const currentRules = asObject(existing?.customRules);
    const nextRules: JsonObject = { ...currentRules };
    if (data.maintenance) {
      nextRules.maintenance = { ...asObject(currentRules.maintenance), ...data.maintenance };
    }
    if (data.autoApproval) {
      nextRules.autoApproval = { ...asObject(currentRules.autoApproval), ...data.autoApproval };
    }
    if (data.payments) {
      const merged: JsonObject = { ...asObject(currentRules.payments), ...data.payments };
      // null means "clear it"
      for (const key of Object.keys(merged)) if (merged[key] === null) delete merged[key];
      nextRules.payments = merged;
    }

    const customRules = nextRules as Prisma.InputJsonObject;
    const saved = await prisma.societyRuleConfig.upsert({
      where: { societyId },
      create: { societyId, customRules },
      update: { customRules },
      select: { customRules: true },
    });

    return this.format(society, saved.customRules);
  }

  private format(
    society: { name: string; address: string; city: string },
    customRules: unknown,
  ) {
    const rules = asObject(customRules);
    const maintenance = asObject(rules.maintenance);
    const autoApproval = asObject(rules.autoApproval);
    const payments = asObject(rules.payments);

    return {
      society: { name: society.name, address: society.address, city: society.city },
      payments: {
        upiId: typeof payments.upiId === 'string' && payments.upiId ? payments.upiId : null,
        payeeName: typeof payments.payeeName === 'string' && payments.payeeName ? payments.payeeName : null,
      } satisfies PaymentSettings,
      maintenance: {
        monthlyFee: numberOr(maintenance.monthlyFee, DEFAULT_MAINTENANCE.monthlyFee),
        dueDayOfMonth: numberOr(maintenance.dueDayOfMonth, DEFAULT_MAINTENANCE.dueDayOfMonth),
        gracePeriodDays: numberOr(maintenance.gracePeriodDays, DEFAULT_MAINTENANCE.gracePeriodDays),
      } satisfies MaintenanceSettings,
      autoApproval: {
        domesticStaff: booleanOr(autoApproval.domesticStaff, DEFAULT_AUTO_APPROVAL.domesticStaff),
        delivery: booleanOr(autoApproval.delivery, DEFAULT_AUTO_APPROVAL.delivery),
        cab: booleanOr(autoApproval.cab, DEFAULT_AUTO_APPROVAL.cab),
      } satisfies AutoApprovalSettings,
    };
  }
}

/** What a resident needs to pay: the UPI ID and the name to show. Null until the admin sets it up. */
export async function getUpiPayee(societyId: string): Promise<{ upiId: string; payeeName: string } | null> {
  const [society, config] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId }, select: { name: true } }),
    prisma.societyRuleConfig.findUnique({ where: { societyId }, select: { customRules: true } }),
  ]);
  const payments = asObject(asObject(config?.customRules).payments);
  if (typeof payments.upiId !== 'string' || !payments.upiId) return null;
  const payeeName = typeof payments.payeeName === 'string' && payments.payeeName ? payments.payeeName : (society?.name ?? 'Society');
  return { upiId: payments.upiId, payeeName };
}

export const societySettingsService = new SocietySettingsService();
