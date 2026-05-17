import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Payroll from '../src/models/Payroll.js';
import Teacher from '../src/models/Teacher.js';

await mongoose.connect(process.env.MONGO_URI);
const companyId = new mongoose.Types.ObjectId('69cc2de135caca42d4865263');

// Find Miss Summalya (10000 fixed salary teacher)
const teacher = await Teacher.findOne({ company: companyId, name: /summ/i }).lean();
if (!teacher) { console.log('Teacher not found'); process.exit(1); }

console.log('Teacher:', teacher.name, '| _id:', teacher._id);

// All payrolls for this teacher
const all = await Payroll.find({ company: companyId, teacher: teacher._id })
  .sort({ month: 1 }).lean();

console.log('\nAll payrolls:');
all.forEach(p => console.log(
  ' ', new Date(p.month).toISOString().slice(0,10), '| status:', p.status,
  '| netSalary:', p.netSalary, '| _id:', p._id
));

// After fix: only approved + paid in statement
const statementPayrolls = all.filter(p => ['approved', 'paid'].includes(p.status));
console.log('\nPayrolls visible in statement (approved + paid):');
statementPayrolls.forEach(p => console.log(
  ' ', new Date(p.month).toISOString().slice(0,10), '| status:', p.status,
  '| netSalary:', p.netSalary
));

const totalBills = statementPayrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
const totalPaid  = statementPayrolls.filter(p => p.status === 'paid').reduce((s, p) => s + (p.netSalary || 0), 0);
console.log('\nTotal Bills  :', totalBills);
console.log('Total Paid   :', totalPaid);
console.log('Balance Payable:', totalBills - totalPaid);
console.log(totalBills === totalPaid ? '✅ Fully settled' : '⚠️  Outstanding balance');

await mongoose.disconnect();
