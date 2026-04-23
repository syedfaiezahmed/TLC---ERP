/**
 * Final AR fix: Debit AR 3,100 to reach 8,600
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
console.log('✅  Deleted previous correction');

const firstFee = await Fee.findOne({});
const companyId = firstFee.company;
const now = new Date();

// Post correct correction: Debit AR 3,100
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

console.log('✅  Posted AR correction: Dr AR 3,100');

// Verify
const arEntries = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' }},
  { $group: { _id: null, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } }}
]).toArray();

console.log('\nFinal AR: Dr=' + arEntries[0].debit.toFixed(2) + ' Cr=' + arEntries[0].credit.toFixed(2) + ' Net=' + (arEntries[0].debit - arEntries[0].credit).toFixed(2));
console.log('Expected: PKR 8600.00');

await mongoose.disconnect();
