/**
 * fixDeductionLedgerEntry.js
 *
 * One-time fix: payroll 69f523d17ed686edc543f31e has 3 Ledger entries because
 * the old grossCost formula (netSalary + deductions) created an extra deductions CR.
 * This gives DR Salary Expense = 5,640 instead of the correct 1,540 (netSalary).
 *
 * Fix: delete all 3 entries for this payroll, re-post with correct formula.
 */
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Ledger from '../src/models/Ledger.js';
import Payroll from '../src/models/Payroll.js';
import { postPayrollJournal } from '../src/services/payrollJournalService.js';
import { recalculateLedger } from '../src/services/ledgerService.js';

await mongoose.connect(process.env.MONGO_URI);
console.log('✅  MongoDB connected\n');

const salaryMonthEnd = (month) => {
  const d = new Date(month);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

// Find all payrolls that have MORE than 2 accrual Ledger entries (deductions block present)
// or whose Salary Expense debit != netSalary
const companyId = (await (await import('../src/models/Company.js')).default.findOne().lean())?._id;
const companyObjId = new mongoose.Types.ObjectId(companyId);

const allLedgerEntries = await Ledger.find({
  company: companyObjId,
  referenceType: 'payroll',
}).lean();

// Group by referenceId
const byPayroll = {};
allLedgerEntries.forEach(e => {
  const k = String(e.referenceId);
  (byPayroll[k] = byPayroll[k] || []).push(e);
});

let fixed = 0;
for (const [pid, rows] of Object.entries(byPayroll)) {
  const payroll = await Payroll.findById(pid).lean();
  if (!payroll) { console.log('  Skip: no payroll for', pid); continue; }

  const salExpEntry = rows.find(r => r.accountName === 'Salary Expense');
  if (!salExpEntry) { console.log('  Skip: no Salary Expense entry for', pid); continue; }

  const correctDR = payroll.netSalary || 0;

  if (Math.abs(salExpEntry.debit - correctDR) < 0.01 && rows.length === 2) {
    // Already correct: 2 entries, correct debit amount
    continue;
  }

  console.log(`Fix payroll ${pid}: current DR=${salExpEntry.debit}, correct DR=${correctDR}, entries=${rows.length}`);

  // Delete all accrual entries for this payroll
  const deleted = await Ledger.deleteMany({ company: companyObjId, referenceType: 'payroll', referenceId: new mongoose.Types.ObjectId(pid) });
  console.log(`  Deleted ${deleted.deletedCount} entries`);

  // Re-post with correct formula
  try {
    await postPayrollJournal({
      companyId: payroll.company,
      teacherId: payroll.teacher,
      payroll,
      date: salaryMonthEnd(payroll.month),
      isPaid: false,
    });
    console.log(`  Re-posted: DR Salary Expense = ${correctDR}, CR Salary Payable = ${correctDR} ✅`);
    fixed++;
  } catch (err) {
    console.error(`  Error re-posting:`, err.message);
  }
}

console.log(`\n=== Done: ${fixed} payrolls re-posted ===`);

// Recalculate ledger balances
console.log('Recalculating ledger balances...');
await Promise.all([
  recalculateLedger(companyId, null, 'Salary Expense'),
  recalculateLedger(companyId, null, 'Salary Payable'),
]);
console.log('✅  Ledger recalculated');

// Final verification
const aprSalaryExpense = await Ledger.aggregate([
  { $match: { company: companyObjId, accountName: 'Salary Expense', date: { $gte: new Date('2026-04-01'), $lte: new Date('2026-04-30T23:59:59.999Z') } } },
  { $group: { _id: null, total: { $sum: '$debit' } } },
]);
const payrolls = await Payroll.find({ company: companyObjId, status: { $in: ['approved', 'paid'] }, month: { $gte: new Date('2026-04-01'), $lte: new Date('2026-04-30T23:59:59.999Z') } }).select('netSalary').lean();
const netSum = payrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
const ledgerDR = aprSalaryExpense[0]?.total || 0;
console.log('\n=== FINAL VERIFICATION ===');
console.log('April Ledger Salary Expense DR:', ledgerDR);
console.log('April Payroll model netSalary sum:', netSum);
console.log('Match?', Math.abs(ledgerDR - netSum) < 0.01 ? '✅ PERFECT MATCH' : `❌ MISMATCH (diff: ${ledgerDR - netSum})`);

await mongoose.disconnect();
