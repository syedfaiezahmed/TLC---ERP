/**
 * Fix settlement entries to link to correct Fee records
 * The voucher payment settlements have fee: null - need to match them to actual fees
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅  MongoDB connected');

const db = mongoose.connection;
const Ledger = db.collection('ledgers');
const FeePayment = db.collection('feepayments');

// Find AR settlement entries with fee: null
const nullFeeSettlements = await Ledger.find({
  accountName: 'Accounts Receivable',
  credit: { $gt: 0 },
  referenceType: 'adjustment',
  reference: { $regex: 'SETTLE' },
  fee: null,
}).toArray();

console.log(`\nFound ${nullFeeSettlements.length} settlement entries with fee: null\n`);

let fixed = 0;
for (const entry of nullFeeSettlements) {
  try {
    // Find the original fee_payment entry to get the fee ID
    const originalEntry = await Ledger.findOne({
      _id: entry.referenceId,
      accountName: 'Fee Revenue',
      referenceType: 'fee_payment',
    });

    if (originalEntry && originalEntry.fee) {
      // Update the settlement entry with the correct fee
      await Ledger.updateOne(
        { _id: entry._id },
        { $set: { fee: originalEntry.fee } }
      );
      console.log(`✅  Linked settlement ${entry._id} to fee ${originalEntry.fee}`);
      fixed++;
    } else {
      // Try to find via FeePayment reference
      const payment = await FeePayment.findOne({ _id: entry.referenceId });
      if (payment && payment.fee) {
        await Ledger.updateOne(
          { _id: entry._id },
          { $set: { fee: payment.fee } }
        );
        console.log(`✅  Linked settlement ${entry._id} to fee ${payment.fee} (via FeePayment)`);
        fixed++;
      } else {
        console.log(`⚠️  Could not find fee for settlement ${entry._id}`);
      }
    }
  } catch (err) {
    console.error(`❌  Error fixing entry ${entry._id}:`, err.message);
  }
}

console.log(`\nFixed ${fixed} settlement entries.\n`);

// Re-check AR by fee
const arByFee = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' }},
  { $group: { _id: '$fee', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } }}
]).toArray();

console.log('AR by fee after fix:');
let arTotal = 0;
for (const ar of arByFee) {
  const net = ar.debit - ar.credit;
  arTotal += net;
  console.log(`  Fee ${ar._id || 'null'}: Dr=${ar.debit.toFixed(2)} Cr=${ar.credit.toFixed(2)} Net=${net.toFixed(2)}`);
}

console.log(`\nTotal AR: PKR ${arTotal.toFixed(2)}`);

await mongoose.disconnect();
console.log('\nDone.');
