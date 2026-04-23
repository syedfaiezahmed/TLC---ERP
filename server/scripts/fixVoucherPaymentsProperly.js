/**
 * Proper fix: Convert voucher payments from cash-basis to accrual settlement
 * - Reverse: Dr Cash / Cr Fee Revenue (fee_payment type)
 * - Replace with: Dr Cash / Cr Accounts Receivable (settlement)
 * - Keep accrual entries (fee type) unchanged
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

// Find all fee_payment type entries that credit Fee Revenue
const voucherPaymentEntries = await Ledger.find({
  referenceType: 'fee_payment',
  accountName: 'Fee Revenue',
  credit: { $gt: 0 },
}).toArray();

console.log(`\nFound ${voucherPaymentEntries.length} voucher payment entries to convert.\n`);

let converted = 0;
const errors = [];

for (const entry of voucherPaymentEntries) {
  try {
    // Check if already converted
    const already = await Ledger.findOne({
      reference: `PROPER-SETTLE-${entry._id}`,
      accountName: 'Accounts Receivable',
      credit: { $gt: 0 },
    });
    if (already) {
      console.log(`⏭  Entry ${entry._id} already converted`);
      continue;
    }

    const now = new Date();
    const jId = `proper-settle-${entry._id}`;

    // 1. Reverse the Fee Revenue credit
    await Ledger.insertOne({
      company: entry.company,
      student: entry.student,
      fee: entry.fee,
      referenceType: 'adjustment',
      referenceId: entry._id,
      reference: `PROPER-REV-${entry._id}`,
      journalId: jId,
      date: now,
      description: `[Proper Fix] Reverse cash-basis voucher payment - convert to settlement`,
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

    // 2. Post correct Cr Accounts Receivable (settlement)
    await Ledger.insertOne({
      company: entry.company,
      student: entry.student,
      fee: entry.fee,
      referenceType: 'adjustment',
      referenceId: entry._id,
      reference: `PROPER-SETTLE-${entry._id}`,
      journalId: jId,
      date: entry.date,
      description: `[Proper Fix] AR settlement for voucher payment`,
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

    console.log(`✅  Entry ${entry._id} | PKR ${entry.credit} | Converted to Cr AR`);
    converted++;
  } catch (err) {
    errors.push({ entryId: entry._id, error: err.message });
    console.error(`❌  Entry ${entry._id} error:`, err.message);
  }
}

console.log('\n─────────────────────────────────────────────');
console.log(`Voucher payment entries converted: ${converted}`);
console.log(`Errors: ${errors.length}`);
if (errors.length) console.error('Errors:', errors);
console.log('─────────────────────────────────────────────');

// Verify final state
const revenueEntries = await Ledger.aggregate([
  { $match: { accountName: 'Fee Revenue' }},
  { $group: { _id: null, credit: { $sum: '$credit' }, debit: { $sum: '$debit' } }}
]).toArray();

const arEntries = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' }},
  { $group: { _id: null, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } }}
]).toArray();

console.log('\nFinal State:');
if (revenueEntries.length > 0) {
  const revenueNet = revenueEntries[0].credit - revenueEntries[0].debit;
  console.log(`Fee Revenue: Cr=${revenueEntries[0].credit.toFixed(2)} Dr=${revenueEntries[0].debit.toFixed(2)} Net=${revenueNet.toFixed(2)}`);
}
if (arEntries.length > 0) {
  const arNet = arEntries[0].debit - arEntries[0].credit;
  console.log(`Accounts Receivable: Dr=${arEntries[0].debit.toFixed(2)} Cr=${arEntries[0].credit.toFixed(2)} Net=${arNet.toFixed(2)}`);
}

await mongoose.disconnect();
console.log('\nDone.');
