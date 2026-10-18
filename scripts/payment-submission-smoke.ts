/**
 * UPI dues flow against the demo database, with a temporary invoice that is removed at the end:
 * validation of UPI IDs and reference numbers, submit, duplicate protection, admin reject then
 * re-submit, admin confirm marks the invoice PAID, and only open dues can be paid.
 * Run: npx ts-node --files scripts/payment-submission-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { paymentSubmissionService } from '../src/modules/billing/payment-submission.service';
import { societySettingsService, getUpiPayee } from '../src/modules/settings/society-settings.service';
import { submitPaymentSchema, updateSocietySettingsSchema } from '../src/schemas';

const SOCIETY = 'edfccafb-62ab-4331-a423-eb4054261508';
const RESIDENT = '79120472-69bc-4443-8c65-f04ddda9618f';
const ADMIN = '00000000-5ec0-4000-8000-0000000000a1';
const FLAT = '5352aea1-5237-44cb-9dad-76fbd4406af4';
const MONTH = 'SmokeTest 2099';
const UTR1 = 'SMOKE000000001';
const UTR2 = 'SMOKE000000002';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
};
const fails = async (fn: () => Promise<unknown>, contains: string) => {
  try { await fn(); return false; } catch (e: any) { return String(e.message).includes(contains); }
};

async function main() {
  const user = { id: RESIDENT, societyId: SOCIETY, flatId: FLAT };
  const before = await prisma.societyRuleConfig.findUnique({ where: { societyId: SOCIETY }, select: { customRules: true } });
  let invoiceId = '';
  try {
    // --- validation
    const okId = (v: string) => updateSocietySettingsSchema.safeParse({ payments: { upiId: v } }).success;
    check('valid UPI IDs accepted', okId('societyname@okhdfcbank') && okId('dalma.heights-1@ybl') && okId('9876543210@paytm'));
    check('invalid UPI IDs refused', !okId('no-at-sign') && !okId('a@b') && !okId('two@@ybl') && !okId('has space@ybl'));
    const utr = (v: string) => submitPaymentSchema.safeParse({ utr: v });
    check('reference number: spaces and case are cleaned', (utr('  smoke 1234 5678 ') as any).data?.utr === 'SMOKE12345678');
    check('reference number: too short or odd characters refused', !utr('123').success && !utr('ABC-12345678').success);

    // --- settings: save, read back, clear
    await societySettingsService.updateSettings(SOCIETY, { payments: { upiId: 'smoketest@okhdfcbank', payeeName: 'Smoke Society' } });
    let payee = await getUpiPayee(SOCIETY);
    check('UPI ID saved and readable for residents', payee?.upiId === 'smoketest@okhdfcbank' && payee?.payeeName === 'Smoke Society');
    await societySettingsService.updateSettings(SOCIETY, { payments: { upiId: null, payeeName: null } });
    payee = await getUpiPayee(SOCIETY);
    check('clearing the UPI ID works', payee === null);

    // --- temporary invoice for the resident's flat
    const invoice = await prisma.invoice.create({
      data: { month: MONTH, amount: 2500, totalAmount: 2500, status: 'PENDING', dueDate: new Date('2099-01-10'), flatId: FLAT, societyId: SOCIETY },
    });
    invoiceId = invoice.id;

    // --- submit
    const first = await paymentSubmissionService.submit(user, invoiceId, UTR1);
    check('submit creates a SUBMITTED payment for the full amount', first.status === 'SUBMITTED' && first.amount === 2500 && first.utr === UTR1);
    check('a second submit while one is waiting is refused', await fails(() => paymentSubmissionService.submit(user, invoiceId, UTR2), 'already waiting'));
    const waiting = await paymentSubmissionService.listForAdmin(SOCIETY, 'SUBMITTED');
    check('admin sees it in the SUBMITTED list with flat and resident', waiting.some((w) => w.id === first.id && w.flatNumber && w.residentName));
    check('someone else cannot submit for this flat\'s due', await fails(() => paymentSubmissionService.submit({ ...user, flatId: '00000000-0000-0000-0000-000000000000' }, invoiceId, 'OTHER000000001'), 'not found'));

    // --- reject, then submit again with a corrected number
    await paymentSubmissionService.reject(SOCIETY, ADMIN, first.id, 'Reference number not found in bank statement');
    check('rejecting twice is refused', await fails(() => paymentSubmissionService.reject(SOCIETY, ADMIN, first.id, 'again'), 'already rejected'));
    const latest = (await paymentSubmissionService.latestByInvoice([invoiceId])).get(invoiceId);
    check('resident sees REJECTED with the reason', latest?.status === 'REJECTED' && /bank statement/.test(latest.rejectionReason ?? ''));
    check('a rejected reference number cannot be reused', await fails(() => paymentSubmissionService.submit(user, invoiceId, UTR1), 'already used'));
    const second = await paymentSubmissionService.submit(user, invoiceId, UTR2);
    check('after a rejection the resident can submit again', second.status === 'SUBMITTED');

    // --- confirm
    await paymentSubmissionService.confirm(SOCIETY, ADMIN, second.id);
    const paid = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, paidAt: true } });
    check('confirming marks the invoice PAID', paid?.status === 'PAID' && !!paid.paidAt);
    check('confirming twice is refused', await fails(() => paymentSubmissionService.confirm(SOCIETY, ADMIN, second.id), 'already confirmed'));
    check('a paid due cannot be paid again', await fails(() => paymentSubmissionService.submit(user, invoiceId, 'SMOKE000000003'), 'already paid'));
  } finally {
    if (invoiceId) await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {}); // submissions cascade
    // Restore the society's saved rules exactly as they were
    if (before) await prisma.societyRuleConfig.update({ where: { societyId: SOCIETY }, data: { customRules: before.customRules as any } });
    await prisma.paymentSubmission.deleteMany({ where: { utr: { startsWith: 'SMOKE0' } } });
    await prisma.notification.deleteMany({ where: { referenceId: invoiceId || 'none' } }).catch(() => {});
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? 'ALL PASSED' : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
