import type { Request } from 'express';
import { AppError } from './ResponseHandler';

// ============================================
// SOCIETY SCOPING HELPERS
// ============================================

/** Max page size for any paginated list endpoint. */
export const MAX_PAGE_SIZE = 100;

/** Clamp client-supplied pagination: page >= 1, 1 <= limit <= MAX_PAGE_SIZE. */
export function clampPagination(page: unknown, limit: unknown, defaultLimit = 20) {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const l = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(limit)) || defaultLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}

/**
 * The society the caller may act on. Never taken from the client for
 * non-super-admins: it comes from the authenticated user (req.societyId is set
 * by ensureSameSociety, falling back to the user record).
 */
export function getSocietyId(req: Request): string {
  const societyId = req.societyId ?? req.user?.societyId ?? undefined;
  if (!societyId) {
    throw new AppError('Society context required', 403);
  }
  return societyId;
}

// Any Prisma model delegate with findFirst.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FindFirstDelegate = { findFirst: (args: any) => any };

interface FindInSocietyOptions {
  include?: object;
  select?: object;
  /** Extra where conditions (e.g. a relation path instead of a direct societyId column) */
  where?: object;
  /** Use instead of { societyId } when the model has no direct societyId column, e.g. { flat: { societyId } } */
  societyWhere?: object;
  entity?: string;
}

/**
 * Load a record by id, but only if it belongs to the given society.
 * Responds 404 (not 403) so ids in other societies are indistinguishable from
 * ids that don't exist.
 */
export async function findInSociety<M extends FindFirstDelegate>(
  model: M,
  id: string,
  societyId: string | null | undefined,
  options: FindInSocietyOptions = {}
): Promise<NonNullable<Awaited<ReturnType<M['findFirst']>>>> {
  const entity = options.entity ?? 'Record';
  if (!societyId) {
    throw new AppError('Society context required', 403);
  }
  if (!id || typeof id !== 'string') {
    throw new AppError(`${entity} not found`, 404);
  }
  const record = await model.findFirst({
    where: { id, ...(options.societyWhere ?? { societyId }), ...(options.where ?? {}) },
    ...(options.include ? { include: options.include } : {}),
    ...(options.select ? { select: options.select } : {}),
  });
  if (!record) {
    throw new AppError(`${entity} not found`, 404);
  }
  return record;
}
