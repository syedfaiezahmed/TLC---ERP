/**
 * Clean slate: Delete all adjustment entries and redo settlement conversion using FeePayment amounts
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
const Fee = db.collection('fees');

// 1. Delete all adjustment entries
const adjustmentCount = await Ledger.deleteMany({ referenceType: 'adjustment' });
console.log(`Deleted ${adjustmentCount.deletedCount} adjustment entries.`);

// 2. Get all FeePayment records
const payments = await FeePayment.find({}).toArray();
console.log(`\nFeePayment records: ${payments.length}`);
const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);
console.log(`Total from FeePayment: PKR ${totalPaymentAmount.toFixed(2)}`);

// 3. Get company ID
const firstFee = await Fee.findOne({});
const companyId = firstFee.company;
const now = new Date();

// 4. For each FeePayment, convert the corresponding fee_payment entry to settlement
let converted = 0;
for (const payment of payments) {
  if (!payment.fee) continue;
  
  // Find the fee_payment ledger entry for this payment
  const feePaymentEntry = await Ledger.findOne({
    referenceType: 'fee_payment',
    accountName: 'Fee Revenue',
    credit: { $gt: 0 },
  });
  
  // Just create settlement entries directly based on FeePayment data
  // Reverse Fee Revenue
  await Ledger.insertOne({
    company: companyId,
    student: payment.student,
    fee: payment.fee,
    referenceType: 'adjustment',
    referenceId: payment._id,
    reference: `CONVERT-${payment._id}`,
    journalId: `convert-${payment._id}`,
    date: now,
    description: `Convert voucher payment to settlement - reverse cash-basis`,
    debit: payment.amount,
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
    company: companyId,
    student: payment.student,
    fee: payment.fee,
    referenceType: 'adjustment',
    referenceId: payment._id,
    reference: `SETTLE-${payment._id}`,
    journalId: `settle-${payment._id}`,
    date: payment.paymentDate || now,
    description: `AR settlement for voucher payment`,
    debit: 0,
    credit: payment.amount,
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

console.log(`\nConverted ${converted} voucher payments to settlement.`);

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
