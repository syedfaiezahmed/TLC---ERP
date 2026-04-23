/**
 * Delete only the Fee Revenue reversal adjustment entries
 * Keep the AR settlement adjustment entries
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

// Delete only Fee Revenue reversal adjustments (CONVERT- entries)
const revenueReversals = await Ledger.find({
  referenceType: 'adjustment',
  accountName: 'Fee Revenue',
  reference: { $regex: 'CONVERT' },
}).toArray();

console.log(`Found ${revenueReversals.length} Fee Revenue reversal entries to delete.\n`);

for (const entry of revenueReversals) {
  await Ledger.deleteOne({ _id: entry._id });
  console.log(`  Deleted: Dr=${entry.debit} Cr=${entry.credit}`);
}

console.log(`\nDeleted ${revenueReversals.length} Fee Revenue reversal entries.`);

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
