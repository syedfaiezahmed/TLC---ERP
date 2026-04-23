/**
 * Direct fix: Post a correction entry to make AR match Fee.balanceDue
 * Current AR: 11,700
 * Expected AR: 8,600
 * Difference: 3,100 (need to debit AR to reduce the negative balance)
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

// Get company ID
const firstFee = await Fee.findOne({});
const companyId = firstFee.company;

const now = new Date();

// Post correction: Debit AR 3,100 to reduce the negative balance
await Ledger.insertOne({
  company: companyId,
  student: null,
  fee: null,
  referenceType: 'adjustment',
  referenceId: null,
  reference: 'AR-BALANCE-CORRECTION',
  journalId: 'ar-correction',
  date: now,
  description: '[Correction] Adjust AR to match Fee.balanceDue (reduce negative balance)',
  debit: 3100,
  credit: 0,
  type: 'adjustment',
  accountName: 'Accounts Receivable',
  accountType: 'asset',
  relatedAccount: 'Correction Account',
  balance: 0,
  createdAt: now,
  updatedAt: now,
});

console.log('✅  Posted AR correction entry: Dr AR 3,100');

// Verify final state
const arEntries = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' }},
  { $group: { _id: null, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } }}
]).toArray();

console.log('\nFinal AR state:');
if (arEntries.length > 0) {
  const arNet = arEntries[0].debit - arEntries[0].credit;
  console.log(`Accounts Receivable: Dr=${arEntries[0].debit.toFixed(2)} Cr=${arEntries[0].credit.toFixed(2)} Net=${arNet.toFixed(2)}`);
  console.log(`Expected: PKR 8600.00`);
  console.log(`Difference: PKR ${(arNet - 8600).toFixed(2)}`);
}

await mongoose.disconnect();
console.log('\nDone.');
