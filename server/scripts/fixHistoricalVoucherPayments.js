/**
 * Fix historical voucher payment entries
 * Change: Dr Cash / Cr Fee Revenue (wrong) → Dr Cash / Cr Accounts Receivable (correct)
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

// Find all FeePayment-type entries that credited Fee Revenue
const badEntries = await Ledger.find({
  accountName: 'Fee Revenue',
  credit: { $gt: 0 },
  referenceType: { $in: ['fee_payment', 'voucher_payment'] },
}).toArray();

console.log(`\nFound ${badEntries.length} voucher payment entries that incorrectly credited Fee Revenue.\n`);

let fixed = 0;
const errors = [];

for (const entry of badEntries) {
  try {
    // Check if already fixed
    const already = await Ledger.findOne({
      reference: `FIX-${entry._id}`,
      accountName: 'Accounts Receivable',
      credit: { $gt: 0 },
    });
    if (already) {
      console.log(`⏭  Entry ${entry._id} already fixed`);
      continue;
    }

    const now = new Date();
    const jId = `fix-${entry._id}`;

    // 1. Reverse the bad Fee Revenue credit
    await Ledger.insertOne({
      company: entry.company,
      student: entry.student,
      fee: entry.fee,
      referenceType: 'adjustment',
      referenceId: entry._id,
      reference: `FIX-REV-${entry._id}`,
      journalId: jId,
      date: now,
      description: `[Fix] Reverse incorrect Fee Revenue credit from voucher payment`,
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
      reference: `FIX-${entry._id}`,
      journalId: jId,
      date: now,
      description: `[Fix] Correct AR settlement for voucher payment`,
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

    console.log(`✅  Entry ${entry._id} | PKR ${entry.credit} | Fixed to Cr AR`);
    fixed++;
  } catch (err) {
    errors.push({ entryId: entry._id, error: err.message });
    console.error(`❌  Entry ${entry._id} error:`, err.message);
  }
}

console.log('\n─────────────────────────────────────────────');
console.log(`Voucher payment entries fixed: ${fixed}`);
console.log(`Errors: ${errors.length}`);
if (errors.length) console.error('Errors:', errors);
console.log('─────────────────────────────────────────────');

// Verify final state
const revenueEntries = await Ledger.find({ accountName: 'Fee Revenue' }).toArray();
let totalCredit = 0;
let totalDebit = 0;
for (const e of revenueEntries) {
  totalCredit += e.credit || 0;
  totalDebit += e.debit || 0;
}
console.log(`\nFinal Fee Revenue Net: PKR ${(totalCredit - totalDebit).toFixed(2)}`);

const arEntries = await Ledger.find({ accountName: 'Accounts Receivable' }).toArray();
let arDebit = 0;
let arCredit = 0;
for (const e of arEntries) {
  arDebit += e.debit || 0;
  arCredit += e.credit || 0;
}
console.log(`Accounts Receivable Net: PKR ${(arDebit - arCredit).toFixed(2)} (should equal outstanding fees)`);

await mongoose.disconnect();
console.log('Done.');
