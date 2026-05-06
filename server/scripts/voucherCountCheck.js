import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import FeeVoucher from '../src/models/FeeVoucher.js';
import FeePayment from '../src/models/FeePayment.js';

await mongoose.connect(process.env.MONGO_URI);
const C = new mongoose.Types.ObjectId('69cc2de135caca42d4865263');

const [byStatus, byMonth, recent5Payments] = await Promise.all([
  FeeVoucher.aggregate([
    { $match: { company: C } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalFee: { $sum: '$totalFee' } } },
    { $sort: { _id: 1 } }
  ]),
  FeeVoucher.aggregate([
    { $match: { company: C, status: { $ne: 'cancelled' } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$month' } }, count: { $sum: 1 }, totalFee: { $sum: '$totalFee' } } },
    { $sort: { _id: 1 } }
  ]),
  FeePayment.find({ company: C, status: 'active' }).sort({ paymentDate: -1 }).limit(5).select('paymentDate amount paymentNumber').lean()
]);

console.log('\nVoucher counts by status:');
byStatus.forEach(s => console.log(`  ${s._id}: count=${s.count}, totalFee=${s.totalFee}`));
const total = byStatus.reduce((s, r) => s + r.totalFee, 0);
console.log('  TOTAL all statuses:', total);

console.log('\nVoucher breakdown by billing month:');
byMonth.forEach(m => console.log(`  ${m._id}: ${m.count} vouchers, PKR ${m.totalFee}`));

console.log('\nLast 5 payments:');
recent5Payments.forEach(p => console.log(`  ${p.paymentNumber} | ${new Date(p.paymentDate).toDateString()} | PKR ${p.amount}`));

await mongoose.disconnect();
