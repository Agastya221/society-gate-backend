/**
 * Idempotent: gives every DomesticStaff row with passCode = NULL a unique 8-char
 * code. Safe to re-run — staff that already have a code are skipped.
 * Run: npx ts-node scripts/backfill-staff-pass-codes.ts
 */
import { prisma } from '../src/utils/Client';
import { generateUniqueStaffPassCode } from '../src/modules/domestic-staff/domestic-staff.service';

async function main() {
  const staffWithoutCode = await prisma.domesticStaff.findMany({
    where: { passCode: null },
    select: { id: true, name: true },
  });

  console.log(`${staffWithoutCode.length} staff rows need a pass code`);

  let updated = 0;
  for (const staff of staffWithoutCode) {
    const passCode = await generateUniqueStaffPassCode();
    await prisma.domesticStaff.update({ where: { id: staff.id }, data: { passCode } });
    updated++;
  }

  console.log(`Backfilled ${updated} staff pass codes`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(Number(process.exitCode ?? 0));
  });
