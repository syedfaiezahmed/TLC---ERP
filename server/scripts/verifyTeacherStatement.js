/**
 * Verify opening balance calculation after fix (approved only, no draft)
 */
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Payroll from '../src/models/Payroll.js';

await mongoose.connect(process.env.MONGO_URI);
const companyId = new mongoose.Types.ObjectId('69cc2de135caca42d4865263');
const startDate = new Date('2026-04-01');

const aprPayrolls = await Payroll.find({ company: companyId, status: { $in: ['approved', 'paid'] } }).lean();
console.log('=== Opening Balance (FIXED: approved only, no draft) ===');

for (const p of aprPayrolls) {
  const tId = new mongoose.Types.ObjectId(p.teacher);
  const priorApprovedOnly = await Payroll.find({
    company: companyId, teacher: tId,
    status: 'approved',               // ← FIXED: only approved, not draft
    month: { $lt: startDate },
  }).select('netSalary month status').lean();

  const openingBalance = priorApprovedOnly.reduce((s, x) => s + (x.netSalary || 0), 0);

  if (openingBalance > 0 || priorApprovedOnly.length > 0) {
    console.log(`Teacher ${p.teacher}: openingBalance = ${openingBalance} (from ${priorApprovedOnly.length} approved prior payrolls)`);
    priorApprovedOnly.forEach(x => console.log('  ', x._id, x.status, new Date(x.month).toISOString(), 'net:', x.netSalary));
  } else {
    console.log(`Teacher ${p.teacher}: openingBalance = 0 ✅`);
  }
}

console.log('\n=== All teachers with April payrolls should show openingBalance = 0 ===');
console.log('(since all April payrolls are paid, and there are no approved prior payrolls)');
await mongoose.disconnect();
