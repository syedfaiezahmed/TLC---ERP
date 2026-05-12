/**
 * fixMissingPayrollJournals.js
 *
 * Detects approved/paid payrolls that have no corresponding Ledger entry
 * (Salary Expense) and posts the missing accrual journal.
 *
 * Run: node scripts/fixMissingPayrollJournals.js
 */
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Ledger from '../src/models/Ledger.js';
import Payroll from '../src/models/Payroll.js';
import { postPayrollJournal } from '../src/services/payrollJournalService.js';

await mongoose.connect(process.env.MONGO_URI);
console.log('✅  MongoDB connected\n');

// Last moment of the salary month
const salaryMonthEnd = (month) => {
  const d = new Date(month);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

// Find all approved or paid payrolls
const payrolls = await Payroll.find({
  status: { $in: ['approved', 'paid'] },
}).lean();

console.log(`Found ${payrolls.length} approved/paid payrolls to check`);

let posted = 0;
let alreadyOk = 0;
let errors = 0;

for (const payroll of payrolls) {
  // Check if a Salary Expense Ledger entry exists for this payroll
  const existingEntry = await Ledger.findOne({
    referenceId: payroll._id,
    referenceType: 'payroll',
    accountName: 'Salary Expense',
  }).lean();

  if (existingEntry) {
    alreadyOk++;
    continue;
  }

  // Missing — post the accrual journal now with the correct salary month date
  try {
    await postPayrollJournal({
      companyId: payroll.company,
      teacherId: payroll.teacher,
      payroll,
      date: salaryMonthEnd(payroll.month),
      isPaid: false,
    });
    posted++;
    console.log(
      `  Posted: payroll ${payroll._id} | month: ${new Date(payroll.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} | totalSalary: ${payroll.totalSalary}`
    );
  } catch (err) {
    errors++;
    console.error(`  Error posting payroll ${payroll._id}:`, err.message);
  }
}

console.log(`\n=== Done: ${posted} journals posted, ${alreadyOk} already correct, ${errors} errors ===`);
await mongoose.disconnect();
