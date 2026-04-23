/**
 * Fix AR correctly: Credit AR to reduce the balance
 * Current AR: 14,800
 * Target AR: 8,600
 * Need: Credit AR 6,200
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

// Delete the wrong correction
await Ledger.deleteOne({ reference: 'AR-BALANCE-CORRECTION' });
console.log('✅  Deleted wrong correction entry');

// Get company ID
const firstFee = await Fee.findOne({});
const companyId = firstFee.company;

const now = new Date();

// Post correct correction: Credit AR 6,200 to reduce the balance
await Ledger.insertOne({
  company: companyId,
  student: null,
  fee: null,
  referenceType: 'adjustment',
  referenceId: null,
  reference: 'AR-BALANCE-CORRECTION',
  journalId: 'ar-correction',
  date: now,
  description: '[Correction] Adjust AR to match Fee.balanceDue',
  debit: 0,
  credit: 6200,
  type: 'adjustment',
  accountName: 'Accounts Receivable',
  accountType: 'asset',
  relatedAccount: 'Correction Account',
  balance: 0,
  createdAt: now,
  updatedAt: now,
});

console.log('✅  Posted AR correction entry: Cr AR 6,200');

// Verify final state
const arEntries = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' }},
  { $group: { _id: null, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } }}
]).toArray();

const revenueEntries = await Ledger.aggregate([
  { $match: { accountName: 'Fee Revenue' }},
  { $group: { _id: null, credit: { $sum: '$credit' }, debit: { $sum: '$debit' } }}
]).toArray();

console.log('\nFinal state:');
if (arEntries.length > 0) {
  const arNet = arEntries[0].debit - arEntries[0].credit;
  console.log(`Accounts Receivable: Dr=${arEntries[0].debit.toFixed(2)} Cr=${arEntries[0].credit.toFixed(2)} Net=${arNet.toFixed(2)}`);
  console.log(`Expected: PKR 8600.00`);
  console.log(`Difference: PKR ${(arNet - 8600).toFixed(2)}`);
}
if (revenueEntries.length > 0) {
  const revenueNet = revenueEntries[0].credit - revenueEntries[0].debit;
  console.log(`\nFee Revenue: Cr=${revenueEntries[0].credit.toFixed(2)} Dr=${revenueEntries[0].debit.toFixed(2)} Net=${revenueNet.toFixed(2)}`);
}

await mongoose.disconnect();
console.log('\nDone.');
