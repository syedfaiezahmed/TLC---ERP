/**
 * fixPayrollLedgerDates.js
 *
 * One-time migration: re-date existing payroll accrual Ledger entries
 * so they fall on the last day of the salary month instead of the
 * approval date.
 *
 * ONLY touches referenceType='payroll' entries (Salary Expense + Salary Payable accruals).
 * Does NOT touch referenceType='payroll_payment' entries (Cash/Bank outflow — correct as-is).
 *
 * Run: node scripts/fixPayrollLedgerDates.js
 */

import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Ledger from '../src/models/Ledger.js';
import Payroll from '../src/models/Payroll.js';

await mongoose.connect(process.env.MONGO_URI);
console.log('✅  MongoDB connected');

// Helper: last moment of the salary month
const salaryMonthEnd = (month) => {
  const d = new Date(month);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

// Find all payroll accrual Ledger entries
const accrualEntries = await Ledger.find({ referenceType: 'payroll' }).lean();
console.log(`\nFound ${accrualEntries.length} payroll accrual Ledger entries to inspect`);

let fixed = 0;
let skipped = 0;
let errors = 0;

for (const entry of accrualEntries) {
  try {
    // Look up the Payroll record this entry was posted for
    const payroll = entry.referenceId
      ? await Payroll.findById(entry.referenceId).select('month').lean()
      : null;

    if (!payroll?.month) {
      skipped++;
      continue;
    }

    const correctDate = salaryMonthEnd(payroll.month);
    const currentDate = new Date(entry.date);

    // Skip if already correctly dated (same year+month as salary month)
    if (
      correctDate.getFullYear() === currentDate.getFullYear() &&
      correctDate.getMonth()    === currentDate.getMonth()
    ) {
      skipped++;
      continue;
    }

    await Ledger.updateOne(
      { _id: entry._id },
      { $set: { date: correctDate } }
    );

    fixed++;
    console.log(
      `  Fixed: ${entry._id} | account: ${entry.accountName} | was: ${currentDate.toISOString().slice(0,10)} → now: ${correctDate.toISOString().slice(0,10)}`
    );
  } catch (err) {
    errors++;
    console.error(`  Error on ${entry._id}:`, err.message);
  }
}

console.log(`\n=== Done: ${fixed} fixed, ${skipped} already correct, ${errors} errors ===`);
await mongoose.disconnect();
