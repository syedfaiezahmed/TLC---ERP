/**
 * Fix Duplicate Fee Vouchers
 * Finds students with >1 active voucher for the same month and cancels the newer duplicate.
 * Also cancels the duplicate Fee record linked to the cancelled voucher.
 * Run ONCE to clean up existing data, then the new unique index prevents future duplicates.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅  MongoDB connected\n');

const db = mongoose.connection;
const FeeVoucher = db.collection('feevouchers');
const Fee        = db.collection('fees');

// Find all duplicate (company, student, month) groups among non-cancelled vouchers
const duplicates = await FeeVoucher.aggregate([
  { $match: { status: { $ne: 'cancelled' } } },
  {
    $group: {
      _id: {
        company: '$company',
        student: '$student',
        monthYear: { $dateToString: { format: '%Y-%m', date: '$month' } }
      },
      vouchers: { $push: { id: '$_id', voucherNumber: '$voucherNumber', generatedDate: '$generatedDate', totalFee: '$totalFee', fee: '$fee' } },
      count: { $sum: 1 }
    }
  },
  { $match: { count: { $gt: 1 } } }
]).toArray();

if (duplicates.length === 0) {
  console.log('✅  No duplicate vouchers found. Database is clean.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log(`⚠️  Found ${duplicates.length} student-month group(s) with duplicate vouchers:\n`);

let cancelledVouchers = 0;
let cancelledFees = 0;

for (const group of duplicates) {
  // Sort by generatedDate ascending — keep the FIRST (oldest), cancel the rest
  const sorted = group.vouchers.sort((a, b) => new Date(a.generatedDate) - new Date(b.generatedDate));
  const keeper = sorted[0];
  const toCancel = sorted.slice(1);

  console.log(`Student: ${group._id.student} | Month: ${group._id.monthYear}`);
  console.log(`  ✅ KEEP:   Voucher ${keeper.voucherNumber} (generated: ${keeper.generatedDate})`);

  for (const dup of toCancel) {
    console.log(`  ❌ CANCEL: Voucher ${dup.voucherNumber} (generated: ${dup.generatedDate}) | Fee: ${dup.fee}`);

    // Cancel the duplicate voucher
    await FeeVoucher.updateOne(
      { _id: dup.id },
      { $set: { status: 'cancelled', notes: 'Cancelled by fixDuplicateVouchers script — duplicate voucher' } }
    );
    cancelledVouchers++;

    // Cancel the linked Fee record if it exists and is not paid
    if (dup.fee) {
      const feeDoc = await Fee.findOne({ _id: dup.fee });
      if (feeDoc && feeDoc.status !== 'paid') {
        await Fee.updateOne(
          { _id: dup.fee },
          { $set: { status: 'cancelled', balanceDue: 0, notes: 'Cancelled by fixDuplicateVouchers script — duplicate fee' } }
        );
        cancelledFees++;
        console.log(`     → Linked Fee #${feeDoc.feeNumber} also cancelled.`);
      } else if (feeDoc && feeDoc.status === 'paid') {
        console.log(`     ⚠️  Linked Fee #${feeDoc.feeNumber} is PAID — manual review needed!`);
      }
    }
  }
  console.log('');
}

console.log('══════════════════════════════════════════════');
console.log(`DONE: Cancelled ${cancelledVouchers} duplicate voucher(s) and ${cancelledFees} fee record(s).`);
console.log('══════════════════════════════════════════════\n');

await mongoose.disconnect();
