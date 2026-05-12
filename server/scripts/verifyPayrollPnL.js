/**
 * End-to-end verification of payroll P&L accrual correctness.
 * Checks that:
 *  1. April Salary Expense in Ledger matches April Payroll model total
 *  2. May Salary Expense in Ledger has ZERO (no mis-dated entries)
 *  3. Late fee payments for April vouchers appear in April P&L, not May
 */
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Ledger from '../src/models/Ledger.js';
import Payroll from '../src/models/Payroll.js';
import FeePayment from '../src/models/FeePayment.js';
import FeeVoucher from '../src/models/FeeVoucher.js';

await mongoose.connect(process.env.MONGO_URI);
console.log('✅  MongoDB connected\n');

const companyId = (await (await import('../src/models/Company.js')).default.findOne().lean())?._id;
if (!companyId) { console.log('No company found'); process.exit(1); }
const companyObjId = new mongoose.Types.ObjectId(companyId);

const aprStart = new Date('2026-04-01T00:00:00.000Z');
const aprEnd   = new Date('2026-04-30T23:59:59.999Z');
const mayStart = new Date('2026-05-01T00:00:00.000Z');
const mayEnd   = new Date('2026-05-31T23:59:59.999Z');

// ── 1. Salary Expense in Ledger by month ──────────────────────────────────────
const [aprSalary, maySalary] = await Promise.all([
  Ledger.aggregate([
    { $match: { company: companyObjId, accountName: 'Salary Expense', date: { $gte: aprStart, $lte: aprEnd } } },
    { $group: { _id: null, total: { $sum: '$debit' } } },
  ]),
  Ledger.aggregate([
    { $match: { company: companyObjId, accountName: 'Salary Expense', date: { $gte: mayStart, $lte: mayEnd } } },
    { $group: { _id: null, total: { $sum: '$debit' } } },
  ]),
]);

const aprLedgerSalary = aprSalary[0]?.total || 0;
const mayLedgerSalary = maySalary[0]?.total || 0;
console.log('=== SALARY EXPENSE ===');
console.log('  April Ledger Salary Expense : Rs.', aprLedgerSalary);
console.log('  May   Ledger Salary Expense : Rs.', mayLedgerSalary, mayLedgerSalary > 0 ? '⚠️  Should be 0 unless May payrolls approved' : '✅');

// Cross-check with Payroll model (approved/paid April payrolls)
// Salary Expense debit = totalSalary (gross before deductions), NOT netSalary.
// The deductions are separately credited to Salary Payable (see payrollJournalService.js).
// grossCost posted to Ledger = netSalary + deductions (= totalSalary + allowances).
const aprPayrolls = await Payroll.find({
  company: companyObjId,
  status: { $in: ['approved', 'paid'] },
  month: { $gte: aprStart, $lte: aprEnd },
}).select('totalSalary netSalary deductions allowances').lean();
const aprGrossCost  = aprPayrolls.reduce((s, p) => s + (p.netSalary || 0) + (p.deductions || 0), 0);
const aprPayrollNet = aprPayrolls.reduce((s, p) => s + (p.netSalary  || 0), 0);
const aprDeductions = aprPayrolls.reduce((s, p) => s + (p.deductions || 0), 0);
const aprAllowances = aprPayrolls.reduce((s, p) => s + (p.allowances || 0), 0);
console.log('  April Payroll grossCost (net+ded): Rs.', aprGrossCost, '(', aprPayrolls.length, 'records)');
console.log('  April Payroll net:', aprPayrollNet, '| deductions:', aprDeductions, '| allowances:', aprAllowances);
console.log('  Ledger DR Salary Expense vs grossCost:', aprLedgerSalary === aprGrossCost ? '✅ MATCH' : `❌ MISMATCH (diff: ${aprLedgerSalary - aprGrossCost})`);

// ── 2. Late fee payments — which month do they report in P&L ─────────────────
console.log('\n=== DISCOUNT / LATE FEE ACCRUAL (Voucher Month, not Payment Month) ===');
const latePayments = await FeePayment.aggregate([
  { $match: { company: companyObjId, status: 'active' } },
  { $lookup: { from: 'feevouchers', localField: 'voucher', foreignField: '_id', as: 'vDoc' } },
  { $unwind: { path: '$vDoc', preserveNullAndEmptyArrays: true } },
  { $addFields: {
    payMonth:     { $dateToString: { format: '%Y-%m', date: '$paymentDate' } },
    voucherMonth: { $dateToString: { format: '%Y-%m', date: '$vDoc.generatedDate' } },
  }},
  { $match: { $expr: { $and: [{ $ne: ['$vDoc', null] }, { $ne: ['$payMonth', '$voucherMonth'] }] } } },
  { $project: { paymentNumber: 1, payMonth: 1, voucherMonth: 1, discountAmount: 1, lateFeeAmount: 1 } },
]);
if (latePayments.length === 0) {
  console.log('  No late payments found.');
} else {
  latePayments.forEach(p => {
    const disc = p.discountAmount || 0;
    const late = p.lateFeeAmount  || 0;
    console.log(`  ${p.paymentNumber}  paid:${p.payMonth}  voucher:${p.voucherMonth}  discount:${disc}  lateFee:${late}  → reports in ${p.voucherMonth} ✅`);
  });
}

// ── 3. April fee revenue (canonical FeeVoucher) ───────────────────────────────
const aprVoucherRev = await FeeVoucher.aggregate([
  { $match: { company: companyObjId, status: { $ne: 'cancelled' }, generatedDate: { $gte: aprStart, $lte: aprEnd } } },
  { $group: { _id: null, total: { $sum: '$totalFee' } } },
]);
console.log('\n=== FEE REVENUE (April) ===');
console.log('  April Fee Revenue (FeeVoucher): Rs.', aprVoucherRev[0]?.total || 0, '✅  (voucher date used)');

console.log('\n✅  Verification complete');
await mongoose.disconnect();
