/**
 * Delete all fee_payment type entries (cash-basis)
 * These should not exist in an accrual accounting system
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

// Find all fee_payment entries
const feePaymentEntries = await Ledger.find({
  referenceType: 'fee_payment',
}).toArray();

console.log(`Found ${feePaymentEntries.length} fee_payment entries to delete.\n`);

let deleted = 0;
for (const entry of feePaymentEntries) {
  await Ledger.deleteOne({ _id: entry._id });
  deleted++;
  if (deleted <= 5) console.log(`  Deleted: ${entry.accountName} Cr=${entry.credit} Dr=${entry.debit}`);
}

console.log(`\nDeleted ${deleted} fee_payment entries.`);

// Verify final state
const revenueEntries = await Ledger.aggregate([
  { $match: { accountName: 'Fee Revenue' }},
  { $group: { _id: null, credit: { $sum: '$credit' }, debit: { $sum: '$debit' } }}
]).toArray();

const arEntries = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' }},
  { $group: { _id: null, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } }}
]).toArray();

console.log('\n─────────────────────────────────────────────');
if (revenueEntries.length > 0) {
  const revenueNet = revenueEntries[0].credit - revenueEntries[0].debit;
  console.log(`Fee Revenue: Cr=${revenueEntries[0].credit.toFixed(2)} Dr=${revenueEntries[0].debit.toFixed(2)} Net=${revenueNet.toFixed(2)}`);
  console.log(`Expected: PKR 67500.00`);
}
if (arEntries.length > 0) {
  const arNet = arEntries[0].debit - arEntries[0].credit;
  console.log(`Accounts Receivable: Dr=${arEntries[0].debit.toFixed(2)} Cr=${arEntries[0].credit.toFixed(2)} Net=${arNet.toFixed(2)}`);
  console.log(`Expected: PKR 8600.00`);
}
console.log('─────────────────────────────────────────────');

await mongoose.disconnect();
console.log('\nDone.');
