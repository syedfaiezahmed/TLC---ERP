/**
 * Clean up duplicate entries and redo the conversion correctly
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

// 1. Delete all RESTORE entries from undoCleanup
const restoreEntries = await Ledger.find({
  reference: { $regex: 'RESTORE' },
}).toArray();
console.log(`Found ${restoreEntries.length} RESTORE entries to delete.`);
for (const e of restoreEntries) {
  await Ledger.deleteOne({ _id: e._id });
}
console.log(`Deleted ${restoreEntries.length} RESTORE entries.`);

// 2. Delete all PROPER adjustment entries
const properEntries = await Ledger.find({
  reference: { $regex: 'PROPER' },
}).toArray();
console.log(`\nFound ${properEntries.length} PROPER adjustment entries to delete.`);
for (const e of properEntries) {
  await Ledger.deleteOne({ _id: e._id });
}
console.log(`Deleted ${properEntries.length} PROPER adjustment entries.`);

// 3. Check remaining fee_payment entries
const remainingFeePayment = await Ledger.find({
  referenceType: 'fee_payment',
  accountName: 'Fee Revenue',
  credit: { $gt: 0 },
}).toArray();
console.log(`\nRemaining fee_payment entries: ${remainingFeePayment.length}`);
const totalCredit = remainingFeePayment.reduce((sum, e) => sum + e.credit, 0);
console.log(`Total credit: PKR ${totalCredit.toFixed(2)}`);

// 4. Convert these to settlement (only once)
let converted = 0;
for (const entry of remainingFeePayment) {
  const now = new Date();
  const jId = `settle-${entry._id}`;

  // Reverse Fee Revenue credit
  await Ledger.insertOne({
    company: entry.company,
    student: entry.student,
    fee: entry.fee,
    referenceType: 'adjustment',
    referenceId: entry._id,
    reference: `REV-${entry._id}`,
    journalId: jId,
    date: now,
    description: `Convert voucher payment to settlement`,
    debit: entry.credit,
    credit: 0,
    type: 'adjustment',
    accountName: 'Fee Revenue',
    accountType: 'revenue',
    relatedAccount: 'Accounts Receivable',
    balance: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Credit AR
  await Ledger.insertOne({
    company: entry.company,
    student: entry.student,
    fee: entry.fee,
    referenceType: 'adjustment',
    referenceId: entry._id,
    reference: `SETTLE-${entry._id}`,
    journalId: jId,
    date: entry.date,
    description: `AR settlement for voucher payment`,
    debit: 0,
    credit: entry.credit,
    type: 'adjustment',
    accountName: 'Accounts Receivable',
    accountType: 'asset',
    relatedAccount: 'Cash',
    balance: 0,
    createdAt: now,
    updatedAt: now,
  });

  converted++;
}

console.log(`\nConverted ${converted} voucher payment entries to settlement.`);

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
}
if (arEntries.length > 0) {
  const arNet = arEntries[0].debit - arEntries[0].credit;
  console.log(`Accounts Receivable: Dr=${arEntries[0].debit.toFixed(2)} Cr=${arEntries[0].credit.toFixed(2)} Net=${arNet.toFixed(2)}`);
}
console.log('─────────────────────────────────────────────');

await mongoose.disconnect();
console.log('\nDone.');
