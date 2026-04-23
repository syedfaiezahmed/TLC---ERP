/**
 * DIAGNOSE: Why does AR show 8,600 when only 2 overdue vouchers exist (3,500 base)?
 * Find every fee with balanceDue > 0 and show exactly what is outstanding and why.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

const db = mongoose.connection;
const Fee = db.collection('fees');
const FeePayment = db.collection('feepayments');
const FeeVoucher = db.collection('feevouchers');
const Student = db.collection('students');

const SEP = '═'.repeat(70);
console.log(`\n${SEP}`);
console.log('  RECEIVABLES DIAGNOSIS');
console.log(`${SEP}\n`);

// All fees with outstanding balance
const outstandingFees = await Fee.find({ balanceDue: { $gt: 0.01 } }).toArray();
console.log(`Fees with balanceDue > 0: ${outstandingFees.length}`);
console.log(`Total balanceDue: PKR ${outstandingFees.reduce((s,f) => s + (f.balanceDue||0), 0).toFixed(2)}\n`);

// For each fee, find linked voucher, student name, and payments
for (const fee of outstandingFees) {
  const student = await Student.findOne({ _id: fee.student });
  const vouchers = await FeeVoucher.find({ fee: fee._id }).toArray();
  const payments = await FeePayment.find({ fee: fee._id, status: 'active' }).toArray();

  const totalFPPaid = payments.reduce((s, p) => s + p.amount, 0);

  console.log(`Fee #${fee.feeNumber} — ${student?.name || 'Unknown'}`);
  console.log(`  totalAmount:  PKR ${fee.totalAmount}`);
  console.log(`  paidAmount:   PKR ${fee.paidAmount}`);
  console.log(`  writeOff:     PKR ${fee.writeOffAmount || 0}`);
  console.log(`  balanceDue:   PKR ${fee.balanceDue}`);
  console.log(`  status:       ${fee.status}`);
  console.log(`  FeePayments total: PKR ${totalFPPaid} (${payments.length} active payments)`);
  console.log(`  Linked vouchers: ${vouchers.length > 0 ? vouchers.map(v => v.voucherNumber + ' (' + v.status + ')').join(', ') : 'NONE'}`);

  // Check: paidAmount should equal FeePayment total
  if (Math.abs(totalFPPaid - (fee.paidAmount||0)) > 0.01) {
    console.log(`  ❌ DRIFT: fee.paidAmount(${fee.paidAmount}) ≠ FeePayment total(${totalFPPaid})`);
  }
  // Check: balanceDue formula
  const expectedBalance = Math.max(0, fee.totalAmount - (fee.paidAmount||0) - (fee.writeOffAmount||0) - (fee.refundAmount||0));
  if (Math.abs(expectedBalance - (fee.balanceDue||0)) > 0.01) {
    console.log(`  ❌ BALANCE FORMULA ERROR: expected ${expectedBalance.toFixed(2)} but stored ${fee.balanceDue}`);
  }
  console.log('');
}

// Summary: voucher-linked vs non-linked
const allFees = await Fee.find({}).toArray();
let voucherLinked = 0, noVoucher = 0, voucherLinkedBalance = 0, noVoucherBalance = 0;
for (const fee of allFees) {
  const vouchers = await FeeVoucher.find({ fee: fee._id }).toArray();
  if (vouchers.length > 0) {
    voucherLinked++;
    voucherLinkedBalance += fee.balanceDue || 0;
  } else {
    noVoucher++;
    noVoucherBalance += fee.balanceDue || 0;
    if ((fee.balanceDue || 0) > 0) {
      const student = await Student.findOne({ _id: fee.student });
      console.log(`No-Voucher Fee #${fee.feeNumber} (${student?.name}): total=${fee.totalAmount} paid=${fee.paidAmount} balance=${fee.balanceDue}`);
    }
  }
}

console.log(`\n${'─'.repeat(70)}`);
console.log(`Fees linked to voucher:     ${voucherLinked}  |  Balance: PKR ${voucherLinkedBalance.toFixed(2)}`);
console.log(`Fees WITHOUT voucher:       ${noVoucher}  |  Balance: PKR ${noVoucherBalance.toFixed(2)}`);
console.log(`Total AR:                   PKR ${(voucherLinkedBalance + noVoucherBalance).toFixed(2)}`);

// Show all vouchers with balance > 0 
const overdueVouchers = await FeeVoucher.find({ status: { $in: ['overdue', 'pending', 'partial'] } }).toArray();
console.log(`\nVouchers with status overdue/pending/partial: ${overdueVouchers.length}`);
for (const v of overdueVouchers) {
  const student = await Student.findOne({ _id: v.student });
  const balance = (v.totalWithLateFee || v.totalFee) - (v.paidAmount || 0);
  console.log(`  ${v.voucherNumber} — ${student?.name}: status=${v.status} totalFee=${v.totalFee} paidAmount=${v.paidAmount} balance=${balance}`);
}

await mongoose.disconnect();
