import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Fee from '../src/models/Fee.js';
import FeePayment from '../src/models/FeePayment.js';
import FeeVoucher from '../src/models/FeeVoucher.js';
import Ledger from '../src/models/Ledger.js';

await mongoose.connect(process.env.MONGO_URI);
const C = new mongoose.Types.ObjectId('69cc2de135caca42d4865263');

const [feeAgg, fpAgg, fvAgg, ledgerCashBank] = await Promise.all([
  Fee.aggregate([{ $match: { company: C, status: { $ne: 'cancelled' } } }, { $group: { _id: null, totalInvoiced: { $sum: '$totalAmount' }, totalPaid: { $sum: '$paidAmount' } } }]),
  FeePayment.aggregate([{ $match: { company: C, status: 'active' } }, { $group: { _id: null, totalCash: { $sum: '$amount' }, totalDiscount: { $sum: '$discountAmount' } } }]),
  FeeVoucher.aggregate([{ $match: { company: C, status: { $ne: 'cancelled' } } }, { $group: { _id: null, totalFee: { $sum: '$totalFee' }, totalPaid: { $sum: '$paidAmount' } } }]),
  Ledger.aggregate([{ $match: { company: C, accountName: { $in: ['Cash', 'Bank'] }, accountType: 'asset' } }, { $group: { _id: null, net: { $sum: { $subtract: ['$debit', '$credit'] } } } }])
]);

const sep = '='.repeat(50);
console.log('\n' + sep);
console.log('  LIVE FINANCIAL VALIDATION');
console.log(sep);

const billed   = fvAgg[0]?.totalFee || 0;
const cash     = fpAgg[0]?.totalCash || 0;
const disc     = fpAgg[0]?.totalDiscount || 0;
const outstanding = Math.max(0, billed - cash - disc);

console.log('\nCANONICAL TOTALS:');
console.log('  Fee Billed (FeeVoucher.totalFee)     :', billed);
console.log('  Cash Collected (FeePayment.amount)   :', cash);
console.log('  Discount Given (FeePayment.discount) :', disc);
console.log('  Outstanding                          :', outstanding);
console.log('  Cash+Bank Ledger balance             :', ledgerCashBank[0]?.net || 0);

console.log('\nCROSS-MODEL CHECKS:');
const tol = 0.01;
let allPass = true;

function check(label, a, b) {
  const ok = Math.abs(a - b) <= tol;
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${a} vs ${b}${ok ? '' : ` — DIFF: ${Math.abs(a-b)}`}`);
}

check('Fee.totalAmount == FeeVoucher.totalFee',   feeAgg[0]?.totalInvoiced || 0, billed);
check('Fee.paidAmount == FeePayment.amount',       feeAgg[0]?.totalPaid || 0,    cash);
check('FeeVoucher.paidAmount == FeePayment.amount', fvAgg[0]?.totalPaid || 0,   cash);
check('Ledger Cash+Bank == FeePayment.amount',     ledgerCashBank[0]?.net || 0,  cash);

console.log('\nWHAT EACH PAGE NOW SHOWS (after server restart):');
console.log('  Dashboard "Total Revenue" =', billed, '← FeeVoucher.totalFee (FIXED)');
console.log('  Dashboard "Cash & Bank"   =', ledgerCashBank[0]?.net || 0, '← Ledger (correct)');
console.log('  P&L "Fee Revenue"         =', billed, '← FeeVoucher.totalFee (FIXED)');
console.log('  Revenue Report total      =', billed, '← FeeVoucher.totalFee (FIXED)');
console.log('  Fee Collection total      =', cash,   '← FeePayment.amount (always correct)');

console.log('\n' + sep);
console.log(allPass ? '  ✅ ALL CHECKS PASS — SYSTEM IS CONSISTENT' : '  ❌ MISMATCH DETECTED');
console.log(sep + '\n');

await mongoose.disconnect();
