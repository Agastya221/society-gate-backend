/**
 * One-off repair: re-derive Flat.isOccupied / occupancyStatus from real state
 * (currentOwnerId / currentTenantId / active UserFlatMembership rows).
 *
 * Seeded flats were left with isOccupied=true but no owner, tenant or membership,
 * so empty flats showed up as "Occupied" and were included in billing
 * (billing.service generates invoices for isOccupied flats) and the guard flat search.
 *
 * Dry run (default — prints what would change, writes nothing):
 *   npx ts-node scripts/repair-flat-occupancy.ts
 * Apply:
 *   npx ts-node scripts/repair-flat-occupancy.ts --apply
 * Limit to one society:
 *   npx ts-node scripts/repair-flat-occupancy.ts --society=<societyId> [--apply]
 *
 * NOT run as part of the fix — review the dry-run output first.
 */
import { prisma } from '../src/utils/Client';
import { deriveFlatOccupancy } from '../src/modules/onboarding/onboarding.service';

type OccupancyStatus = 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT';

async function main() {
  const apply = process.argv.includes('--apply');
  const societyArg = process.argv.find((a) => a.startsWith('--society='));
  const societyId = societyArg ? societyArg.split('=')[1] : undefined;

  const flats = await prisma.flat.findMany({
    where: { isActive: true, ...(societyId ? { societyId } : {}) },
    select: {
      id: true,
      flatNumber: true,
      societyId: true,
      isOccupied: true,
      occupancyStatus: true,
      currentOwnerId: true,
      currentTenantId: true,
      userMemberships: {
        where: { isActive: true },
        select: { residentType: true, isOwner: true, isLivingHere: true },
      },
    },
  });

  let changed = 0;
  for (const flat of flats) {
    const occ = deriveFlatOccupancy(flat);
    // Mirrors onboarding approval: tenant -> RENTED; someone living here -> OWNER_OCCUPIED;
    // owner on record but not living here -> isOccupied=true with VACANT status.
    const someoneLivesHere = flat.userMemberships.some((m) => m.isLivingHere);
    const status: OccupancyStatus = occ.hasTenant
      ? 'RENTED'
      : someoneLivesHere
        ? 'OWNER_OCCUPIED'
        : 'VACANT';

    if (flat.isOccupied === occ.isOccupied && flat.occupancyStatus === status) continue;
    changed++;
    console.log(
      `${flat.societyId} ${flat.flatNumber}: isOccupied ${flat.isOccupied} -> ${occ.isOccupied}, ` +
        `occupancyStatus ${flat.occupancyStatus} -> ${status}`,
    );
    if (apply) {
      await prisma.flat.update({
        where: { id: flat.id },
        data: { isOccupied: occ.isOccupied, occupancyStatus: status },
      });
    }
  }

  console.log(`${changed} of ${flats.length} flats ${apply ? 'updated' : 'would change (dry run)'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
