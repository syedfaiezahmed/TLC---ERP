/**
 * Match settlement entries to FeePayment records by amount and date
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

// Get all FeePayment records
const payments = await FeePayment.find({}).toArray();
console.log(`Total FeePayment records: ${payments.length}\n`);

let fixed = 0;
for (const entry of nullFeeSettlements) {
  try {
    // Find matching FeePayment by amount
    const matchingPayment = payments.find(p => p.amount === entry.credit && p.fee);
    
    if (matchingPayment && matchingPayment.fee) {
      await Ledger.updateOne(
        { _id: entry._id },
        { $set: { fee: matchingPayment.fee } }
      );
      console.log(`✅  Matched settlement PKR ${entry.credit} to FeePayment ${matchingPayment._id} -> fee ${matchingPayment.fee}`);
      fixed++;
    } else {
      console.log(`⚠️  No matching FeePayment found for settlement PKR ${entry.credit}`);
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
console.log(`Expected (balanceDue): PKR 8600.00`);
console.log(`Difference: PKR ${(arTotal - 8600).toFixed(2)}`);

await mongoose.disconnect();
console.log('\nDone.');
