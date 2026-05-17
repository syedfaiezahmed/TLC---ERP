import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Payroll from '../src/models/Payroll.js';

await mongoose.connect(process.env.MONGO_URI);
const companyId = new mongoose.Types.ObjectId('69cc2de135caca42d4865263');

// Get all teachers with April payrolls
const aprPayrolls = await Payroll.find({
  company: companyId,
  status: { $in: ['approved', 'paid'] },
}).sort({ month: 1 }).lean();

console.log('=== All payrolls (by teacher): ===');
const byTeacher = {};
aprPayrolls.forEach(p => {
  const k = String(p.teacher);
  (byTeacher[k] = byTeacher[k] || []).push(p);
});

for (const [tid, payrolls] of Object.entries(byTeacher)) {
  console.log(`\nTeacher: ${tid}`);
  payrolls.forEach(p => {
    const m = new Date(p.month);
    console.log(`  month: ${m.toISOString()} (UTC) = ${m.toLocaleDateString('en-PK',{month:'short',year:'numeric',day:'2-digit',timeZone:'Asia/Karachi'})} PKT`);
    console.log(`  status: ${p.status}, netSalary: ${p.netSalary}, _id: ${p._id}`);
  });
}

// Check for the 2,250 per_class teacher
const perClassPayroll = aprPayrolls.find(p => p.netSalary === 2250);
if (perClassPayroll) {
  const tId = new mongoose.Types.ObjectId(perClassPayroll.teacher);
  const startDate = new Date('2026-04-01'); // what frontend might send
  
  console.log('\n=== Opening Balance Check for per_class teacher (2250) ===');
  console.log('startDate (UTC):', startDate.toISOString());
  console.log('payroll.month (UTC):', new Date(perClassPayroll.month).toISOString());
  console.log('payroll.month < startDate?', new Date(perClassPayroll.month) < startDate);
  
  const priorUnpaid = await Payroll.find({
    company: companyId,
    teacher: tId,
    status: { $in: ['draft', 'approved'] },
    month: { $lt: startDate },
  }).select('netSalary month status').lean();
  console.log('Prior unpaid payrolls (status draft/approved, month < April 1):', priorUnpaid.length);
  priorUnpaid.forEach(p => console.log('  ', String(p._id), p.status, new Date(p.month).toISOString(), 'net:', p.netSalary));
  
  const priorUnpaidNet = priorUnpaid.reduce((s, p) => s + (p.netSalary || 0), 0);
  console.log('Opening balance would be:', priorUnpaidNet);
}

await mongoose.disconnect();
