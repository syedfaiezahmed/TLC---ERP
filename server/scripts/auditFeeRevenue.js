/**
 * Quick audit script — check Fee Revenue ledger state after cleanup
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
const Fee    = db.collection('fees');
const FeePayment = db.collection('feepayments');

console.log('\n───── FEE REVENUE LEDGER AUDIT ─────\n');

// 1. All Fee Revenue entries grouped by referenceType
const revenueEntries = await Ledger.find({ accountName: 'Fee Revenue' }).toArray();
console.log(`Total Fee Revenue entries in ledger: ${revenueEntries.length}`);

const byType = {};
let totalCredit = 0;
let totalDebit = 0;
let cleanupCount = 0;

for (const e of revenueEntries) {
  const t = e.referenceType || 'unknown';
  byType[t] = (byType[t] || 0) + 1;
  totalCredit += e.credit || 0;
  totalDebit += e.debit || 0;
  if (e.description && e.description.includes('Cleanup')) cleanupCount++;
}

console.log('\nBy referenceType:');
for (const [type, count] of Object.entries(byType)) {
  console.log(`  ${type}: ${count}`);
}
console.log(`\nTotal Credit: PKR ${totalCredit.toFixed(2)}`);
console.log(`Total Debit:  PKR ${totalDebit.toFixed(2)}`);
console.log(`Net Fee Revenue: PKR ${(totalCredit - totalDebit).toFixed(2)}`);
console.log(`Cleanup reversal entries: ${cleanupCount}`);

// 2. Check original fee entries (referenceType: 'fee')
const originalFeeEntries = await Ledger.find({ accountName: 'Fee Revenue', referenceType: 'fee' }).toArray();
console.log(`\nOriginal fee accrual entries (referenceType='fee'): ${originalFeeEntries.length}`);
let originalCredit = 0;
for (const e of originalFeeEntries) originalCredit += e.credit || 0;
console.log(`Original fee credits total: PKR ${originalCredit.toFixed(2)}`);

// 3. Check payment entries that may have been incorrectly reversed
const paymentEntries = await Ledger.find({ accountName: 'Fee Revenue', referenceType: { $in: ['fee_payment', 'payment', 'voucher_payment'] } }).toArray();
console.log(`\nPayment-type Fee Revenue entries: ${paymentEntries.length}`);

// 4. Check actual Fee records - what was invoiced
const fees = await Fee.find({}).toArray();
let totalInvoiced = 0;
for (const f of fees) totalInvoiced += f.totalAmount || 0;
console.log(`\nTotal Fee records invoiced: ${fees.length}  Total Amount: PKR ${totalInvoiced.toFixed(2)}`);

// 5. Check FeePayment records - what was collected
const payments = await FeePayment.find({}).toArray();
let totalCollected = 0;
for (const p of payments) totalCollected += p.amount || 0;
console.log(`Total FeePayment records: ${payments.length}  Total Amount: PKR ${totalCollected.toFixed(2)}`);

console.log('\n───── SAMPLE ENTRIES ─────\n');
console.log('Last 5 Fee Revenue entries:');
const last5 = await Ledger.find({ accountName: 'Fee Revenue' }).sort({ date: -1 }).limit(5).toArray();
for (const e of last5) {
  console.log(`  ${e.date.toISOString().split('T')[0]} | ${e.referenceType} | Dr:${e.debit} Cr:${e.credit} | ${e.description?.substring(0, 50)}`);
}

console.log('\nFirst 5 Fee Revenue entries:');
const first5 = await Ledger.find({ accountName: 'Fee Revenue' }).sort({ date: 1 }).limit(5).toArray();
for (const e of first5) {
  console.log(`  ${e.date.toISOString().split('T')[0]} | ${e.referenceType} | Dr:${e.debit} Cr:${e.credit} | ${e.description?.substring(0, 50)}`);
}

await mongoose.disconnect();
