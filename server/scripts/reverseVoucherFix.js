/**
 * Reverse the voucher payment fix - restore original cash-basis entries
 * The fixHistoricalVoucherPayments incorrectly changed Dr Cash/Cr Fee Revenue to Dr Cash/Cr AR
 * But the original entries were correct cash-basis, and accrual entries were separately backfilled
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

// Find all adjustment entries from the fix
const fixEntries = await Ledger.find({
  referenceType: 'adjustment',
  description: { $regex: 'Fix' },
}).toArray();

console.log(`\nFound ${fixEntries.length} adjustment entries from the fix.\n`);

let reversed = 0;
for (const entry of fixEntries) {
  try {
    await Ledger.deleteOne({ _id: entry._id });
    console.log(`✅  Deleted adjustment entry: ${entry.description?.substring(0, 50)}`);
    reversed++;
  } catch (err) {
    console.error(`❌  Error deleting entry ${entry._id}:`, err.message);
  }
}

console.log(`\nDeleted ${reversed} adjustment entries.`);

// Now verify the state
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
}
if (arEntries.length > 0) {
  const arNet = arEntries[0].debit - arEntries[0].credit;
  console.log(`Accounts Receivable: Dr=${arEntries[0].debit.toFixed(2)} Cr=${arEntries[0].credit.toFixed(2)} Net=${arNet.toFixed(2)}`);
}
console.log('─────────────────────────────────────────────');

await mongoose.disconnect();
console.log('\nDone.');
