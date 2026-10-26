import { prisma } from './Client';

/**
 * A person can be a guard and a resident at the same time (a guard who lives in the society). users.role holds
 * only ONE of those, and it flips to RESIDENT when the person is given a flat. Guard access is therefore also
 * read from the active GUARD membership, which the admin's "Add guard" step creates and nothing else removes.
 */

/** "Guards of this society": the old users.role = GUARD rows plus anyone with an active GUARD membership there. */
export const guardUsersWhere = (societyId: string) => ({
  OR: [
    { societyId, role: 'GUARD' as const },
    { flatMemberships: { some: { societyId, role: 'GUARD' as const, isActive: true } } },
  ],
});

/** Society staff to alert: the given roles, and (when GUARD is asked for) guards who are also residents. */
export const societyStaffWhere = (societyId: string, roles: readonly string[]) => ({
  isActive: true,
  OR: [
    { societyId, role: { in: roles as never } },
    ...(roles.includes('GUARD')
      ? [{ flatMemberships: { some: { societyId, role: 'GUARD' as const, isActive: true } } }]
      : []),
  ],
});

/** The society this person guards (an active guard membership in an active society), or null. */
export const findGuardPost = (userId: string) =>
  prisma.userFlatMembership.findFirst({
    where: { userId, role: 'GUARD', isActive: true, society: { isActive: true } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: {
      societyId: true,
      society: { select: { id: true, name: true, address: true, city: true, isActive: true } },
    },
  });

/**
 * The person as the guard app sees them: a RESIDENT who also holds an active guard post becomes a GUARD of that
 * society. Use it only where the caller is acting as a guard (guard-only endpoints, or the guard app's session).
 */
export async function withGuardPost<T extends { role: string; societyId: string | null }>(
  user: T | null,
  userId: string,
): Promise<T | null> {
  if (!user || user.role !== 'RESIDENT') return user;
  const post = await findGuardPost(userId);
  if (!post) return user;
  const view = { ...user, role: 'GUARD', societyId: post.societyId } as T & { society?: { name: string } };
  if ('society' in view) view.society = { name: post.society.name };
  return view;
}
