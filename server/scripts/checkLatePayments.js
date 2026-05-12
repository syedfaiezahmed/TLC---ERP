import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import FeePayment from '../src/models/FeePayment.js';
import Payroll from '../src/models/Payroll.js';

await mongoose.connect(process.env.MONGO_URI);
console.log('Connected');

// 1. Find payments whose paymentDate month ≠ voucher.generatedDate month
const latePayments = await FeePayment.aggregate([
  { $match: { status: 'active' } },
  { $lookup: { from: 'feevouchers', localField: 'voucher', foreignField: '_id', as: 'vDoc' } },
  { $unwind: { path: '$vDoc', preserveNullAndEmptyArrays: true } },
  { $addFields: {
    payMonth:     { $dateToString: { format: '%Y-%m', date: '$paymentDate' } },
    voucherMonth: { $dateToString: { format: '%Y-%m', date: '$vDoc.generatedDate' } },
  }},
  { $match: { $expr: { $and: [
    { $ne: ['$vDoc', null] },
    { $ne: ['$payMonth', '$voucherMonth'] }
  ]}}},
  { $project: { paymentNumber: 1, payMonth: 1, voucherMonth: 1, amount: 1 } },
]);

console.log('\n=== LATE FEE PAYMENTS (paid in a different month than voucher) ===');
if (latePayments.length === 0) {
  console.log('  None in DB (test with a real late payment to verify)');
} else {
  latePayments.forEach(p => console.log(
    `  ${p.paymentNumber}  |  paid: ${p.payMonth}  |  voucher: ${p.voucherMonth}  |  Rs. ${p.amount}`
  ));
}
console.log(`  Total: ${latePayments.length}`);

// 2. Find payrolls that were paid in a later month than their salary month
const latePayrolls = await Payroll.find({ status: 'paid', paidDate: { $exists: true } }).lean();
const lateP = latePayrolls.filter(p => {
  const salaryM = new Date(p.month).getMonth() + ':' + new Date(p.month).getFullYear();
  const paidM   = new Date(p.paidDate).getMonth() + ':' + new Date(p.paidDate).getFullYear();
  return salaryM !== paidM;
});

console.log('\n=== LATE SALARY PAYMENTS (paid in a different month than salary month) ===');
if (lateP.length === 0) {
  console.log('  None in DB (test with a real late payment to verify)');
} else {
  lateP.forEach(p => console.log(
    `  payroll ${p._id}  |  salary month: ${new Date(p.month).toLocaleDateString('en-US', {month:'short',year:'numeric'})}  |  paid: ${new Date(p.paidDate).toLocaleDateString('en-US', {month:'short',year:'numeric'})}  |  Rs. ${p.netSalary}`
  ));
}
console.log(`  Total: ${lateP.length}`);

await mongoose.disconnect();
