import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// This is intentionally separate from seed.ts. It is safe to run against an
// existing database because it only creates/updates StaffAccount rows and does
// not delete or recreate residents, flats, or domestic-staff profiles.
const staffPhones = [
  '9700000001', '9700000002', '9700000003', '9700000004',
  '9700000005', '9700000006', '9700000007',
];

async function main() {
  const profiles = await prisma.domesticStaff.findMany({
    where: { phone: { in: staffPhones } },
    select: { id: true, phone: true, name: true, isActive: true, isVerified: true },
  });

  const foundPhones = new Set(profiles.map((profile) => profile.phone));
  const missingPhones = staffPhones.filter((phone) => !foundPhones.has(phone));
  if (missingPhones.length > 0) {
    console.warn(`⚠️ No DomesticStaff profile found for: ${missingPhones.join(', ')}`);
  }

  for (const profile of profiles) {
    await prisma.staffAccount.upsert({
      where: { domesticStaffId: profile.id },
      update: { phone: profile.phone, isActive: profile.isActive },
      create: { domesticStaffId: profile.id, phone: profile.phone, isActive: profile.isActive },
    });
    console.log(`✅ Staff app account ready: ${profile.name} (${profile.phone})${profile.isVerified ? '' : ' [not verified]'}`);
  }

  console.log(`\nCreated/updated ${profiles.length} staff app account(s).`);
}

main()
  .catch((error) => { console.error('❌ Staff seed failed:', error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
