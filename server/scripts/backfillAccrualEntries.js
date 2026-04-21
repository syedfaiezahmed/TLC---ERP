/**
 * Backfill missing accrual journal entries for all fees
 * This fixes the root cause: fees were created but Dr AR / Cr Fee Revenue was never posted
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
const Fee = db.collection('fees');

const fees = await Fee.find({}).toArray();
console.log(`\nBackfilling accrual entries for ${fees.length} fees...\n`);

let backfilled = 0;
const errors = [];

for (const f of fees) {
  try {
    // Check if accrual entry already exists
    const existing = await Ledger.findOne({
      referenceType: 'fee',
      fee: f._id,
      accountName: 'Fee Revenue',
      credit: { $gt: 0 },
    });
    if (existing) {
      console.log(`⏭  Fee #${f.feeNumber} already has accrual entry`);
      continue;
    }

    const feeObjId = typeof f._id === 'string' ? new mongoose.Types.ObjectId(f._id) : f._id;
    const studentObjId = typeof f.student === 'string' ? new mongoose.Types.ObjectId(f.student) : f.student;
    const companyObjId = typeof f.company === 'string' ? new mongoose.Types.ObjectId(f.company) : f.company;

    const journalId = `fee-${feeObjId}`;
    const now = f.date || new Date();

    // Post Dr Accounts Receivable
    await Ledger.insertOne({
      company: companyObjId,
      student: studentObjId,
      fee: feeObjId,
      referenceType: 'fee',
      referenceId: feeObjId,
      reference: f.feeNumber?.toString(),
      journalId,
      date: now,
      description: `Fee #${f.feeNumber} - Receivable`,
      debit: f.totalAmount,
      credit: 0,
      type: 'fee',
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      relatedAccount: 'Fee Revenue',
      balance: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Post Cr Fee Revenue
    await Ledger.insertOne({
      company: companyObjId,
      student: studentObjId,
      fee: feeObjId,
      referenceType: 'fee',
      referenceId: feeObjId,
      reference: f.feeNumber?.toString(),
      journalId,
      date: now,
      description: `Fee #${f.feeNumber} - Fee Revenue`,
      debit: 0,
      credit: f.totalAmount,
      type: 'fee',
      accountName: 'Fee Revenue',
      accountType: 'revenue',
      relatedAccount: 'Accounts Receivable',
      balance: 0,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✅  Fee #${f.feeNumber} | PKR ${f.totalAmount} | Accrual entries posted`);
    backfilled++;
  } catch (err) {
    errors.push({ feeNumber: f.feeNumber, error: err.message });
    console.error(`❌  Fee #${f.feeNumber} error:`, err.message);
  }
}

console.log('\n─────────────────────────────────────────────');
console.log(`Accrual entries backfilled: ${backfilled}`);
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

await mongoose.disconnect();
console.log('Done.');
