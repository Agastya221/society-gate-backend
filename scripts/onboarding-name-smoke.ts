/**
 * The join request can carry the applicant's name. Builds a throwaway society, then removes it.
 * Run: npx ts-node --transpile-only scripts/onboarding-name-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { OnboardingService } from '../src/modules/onboarding/onboarding.service';

const service = new OnboardingService();
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };

const PHONES = ['9000000201', '9000000202', '9000000203'];

(async () => {
  let societyId = '';
  try {
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    const society = await prisma.society.create({ data: { name: 'Name Step Test Society', address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000299', isActive: true, nextDueDate: new Date() } });
    societyId = society.id;
    const block = await prisma.block.create({ data: { societyId, name: 'A' } });
    const flats = await Promise.all(['101', '102', '103'].map((n) => prisma.flat.create({ data: { societyId, blockId: block.id, flatNumber: n } })));
    const users = await Promise.all(PHONES.map((phone, i) => prisma.user.create({ data: { phone, name: i === 1 ? 'Keep Me' : '', role: 'RESIDENT', isActive: false } })));

    const submit = (i: number, name?: string) => service.submitOnboardingRequest(users[i].id, {
      societyId, blockId: block.id, flatId: flats[i].id, residentType: 'OWNER', isLivingHere: true, name,
      documents: [
        { type: 'OWNERSHIP_PROOF', s3Key: `onboarding/${users[i].id}/proof.png` },
        { type: 'AADHAR_CARD', s3Key: `onboarding/${users[i].id}/id.png` },
      ],
    });

    await submit(0, 'Rahul Verma');
    check('a typed name fills an account that has none', (await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).name === 'Rahul Verma');

    await submit(1, 'Someone Else');
    check('it never renames an account that already has a name', (await prisma.user.findUniqueOrThrow({ where: { id: users[1].id } })).name === 'Keep Me');

    await submit(2);
    check('a request without a name still works (older app builds)', (await prisma.onboardingRequest.count({ where: { userId: users[2].id, status: 'PENDING_APPROVAL' } })) === 1);
    check('and leaves the name empty', (await prisma.user.findUniqueOrThrow({ where: { id: users[2].id } })).name === '');

    const pending = await prisma.onboardingRequest.findFirstOrThrow({ where: { userId: users[0].id }, include: { user: { select: { name: true } } } });
    check('the admin list shows the name next to the request', pending.user.name === 'Rahul Verma');
  } finally {
    const ids = (await prisma.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } })).map((u) => u.id);
    const requests = (await prisma.onboardingRequest.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((r) => r.id);
    await prisma.onboardingAuditLog.deleteMany({ where: { onboardingRequestId: { in: requests } } });
    await prisma.residentDocument.deleteMany({ where: { onboardingRequestId: { in: requests } } });
    await prisma.onboardingRequest.deleteMany({ where: { id: { in: requests } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.flat.deleteMany({ where: { societyId } });
    await prisma.block.deleteMany({ where: { societyId } });
    await prisma.society.deleteMany({ where: { id: societyId } });
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
