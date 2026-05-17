import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Ledger from '../src/models/Ledger.js';
import Payroll from '../src/models/Payroll.js';

await mongoose.connect(process.env.MONGO_URI);
const companyId = new mongoose.Types.ObjectId('69cc2de135caca42d4865263');
const apr = { $gte: new Date('2026-04-01'), $lte: new Date('2026-04-30T23:59:59.999Z') };

const entries = await Ledger.find({ company: companyId, referenceType: 'payroll', date: apr })
  .sort({ referenceId: 1, createdAt: 1 }).lean();

console.log('Total payroll accrual Ledger entries in April:', entries.length);
const byPayroll = {};
entries.forEach(e => {
  const k = String(e.referenceId);
  (byPayroll[k] = byPayroll[k] || []).push(e);
});
Object.entries(byPayroll).forEach(([pid, rows]) => {
  const dr = rows.filter(r => r.accountName === 'Salary Expense').reduce((s, r) => s + r.debit, 0);
  const cr = rows.filter(r => r.accountName === 'Salary Payable').reduce((s, r) => s + r.credit, 0);
  console.log(' payroll:', pid, '| entries:', rows.length, '| DR SalExp:', dr, '| CR SalPayable:', cr, dr === cr ? '✅' : '❌ UNBALANCED');
});
const totalDR = entries.filter(e => e.accountName === 'Salary Expense').reduce((s, e) => s + e.debit, 0);
console.log('\nTOTAL DR Salary Expense in Ledger:', totalDR);

const payrolls = await Payroll.find({ company: companyId, status: { $in: ['approved', 'paid'] }, month: apr })
  .select('netSalary deductions allowances').lean();
const sumNet = payrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
const sumDed = payrolls.reduce((s, p) => s + (p.deductions || 0), 0);
console.log('Payroll model netSalary sum:', sumNet, '| deductions sum:', sumDed);
console.log('Expected Salary Expense (netSalary):', sumNet);
console.log('Match?', totalDR === sumNet ? '✅ YES' : `❌ NO (diff: ${totalDR - sumNet})`);

await mongoose.disconnect();
