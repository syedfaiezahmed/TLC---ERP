/**
 * Fix ledger AR gaps caused by FeePayments with discountAmount > 0
 * where the discount Cr AR entry was not posted in the SETTLE- adjustments.
 *
 * For each FeePayment where discountAmount > 0:
 *   - Check if a Dr Scholarship/Discount + Cr AR entry exists for that payment
 *   - If missing, post it now
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅  MongoDB connected\n');

const db = mongoose.connection;
const FeePayment = db.collection('feepayments');
const Ledger = db.collection('ledgers');

// Find all active FeePayments with discounts
const discountedPayments = await FeePayment.find({ status: 'active', discountAmount: { $gt: 0 } }).toArray();
console.log(`Found ${discountedPayments.length} FeePayments with discounts\n`);

let fixed = 0;

for (const fp of discountedPayments) {
  const disc = Number(fp.discountAmount) || 0;
  if (disc <= 0) continue;

  // Check if Scholarship/Discount Dr entry exists for this payment
  const existing = await Ledger.findOne({
    company: fp.company,
    referenceId: fp._id,
    accountName: 'Scholarship/Discount',
    debit: { $gt: 0 },
  });

  // Also check via fee reference (postFeePaymentJournal uses referenceId=fee._id)
  const existingByFee = fp.fee ? await Ledger.findOne({
    company: fp.company,
    referenceId: fp.fee,
    accountName: 'Scholarship/Discount',
    debit: { $gt: 0 },
  }) : null;

  if (existing || existingByFee) {
    console.log(`  FeePayment ${fp.paymentNumber}: discount entry already exists — skipping`);
    continue;
  }

  // Post missing discount journal: Dr Scholarship/Discount / Cr Accounts Receivable
  const journalId = new mongoose.Types.ObjectId().toString();
  const date = fp.paymentDate || new Date();
  const description = `Scholarship/Discount — Payment ${fp.paymentNumber}`;

  await Ledger.insertMany([
    {
      company: fp.company,
      student: fp.student,
      fee: fp.fee || undefined,
      referenceType: 'adjustment',
      referenceId: fp._id,
      reference: `DISC-${fp._id}`,
      journalId,
      date,
      description,
      debit: disc,
      credit: 0,
      type: 'adjustment',
      accountName: 'Scholarship/Discount',
      accountType: 'expense',
      relatedAccount: 'Accounts Receivable',
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      company: fp.company,
      student: fp.student,
      fee: fp.fee || undefined,
      referenceType: 'adjustment',
      referenceId: fp._id,
      reference: `DISC-AR-${fp._id}`,
      journalId,
      date,
      description,
      debit: 0,
      credit: disc,
      type: 'adjustment',
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      relatedAccount: 'Scholarship/Discount',
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  console.log(`  ✅  Posted Dr Scholarship/Discount ${disc} / Cr AR ${disc} for ${fp.paymentNumber}`);
  fixed++;
}

console.log(`\nPosted ${fixed} discount journal entries.\n`);

// Verify final state
const totals = await Ledger.aggregate([
  { $group: { _id: '$accountName', cr: { $sum: '$credit' }, dr: { $sum: '$debit' } } },
  { $sort: { _id: 1 } }
]).toArray();

const totalCr = totals.reduce((s,a) => s + a.cr, 0);
const totalDr = totals.reduce((s,a) => s + a.dr, 0);

console.log('Account Summary:');
for (const a of totals) {
  const net = a.cr - a.dr;
  console.log(`  ${a._id.padEnd(30)} Cr=${a.cr.toFixed(2).padStart(10)}  Dr=${a.dr.toFixed(2).padStart(10)}  Net=${net.toFixed(2).padStart(10)}`);
}

console.log(`\nTotal Credits: ${totalCr.toFixed(2)}`);
console.log(`Total Debits:  ${totalDr.toFixed(2)}`);
console.log(`Balance: ${Math.abs(totalCr - totalDr).toFixed(2)} ${Math.abs(totalCr - totalDr) < 0.01 ? '✅  BALANCED' : '❌  IMBALANCED'}`);

// Check AR vs fee balances
const fees = await db.collection('fees').find({}).toArray();
const feeTotalBalance = fees.reduce((s,f) => s + (f.balanceDue||0), 0);
const arEntry = totals.find(a => a._id === 'Accounts Receivable');
const arNet = arEntry ? arEntry.dr - arEntry.cr : 0;
console.log(`\nAR Ledger:   PKR ${arNet.toFixed(2)}`);
console.log(`Fee Balance: PKR ${feeTotalBalance.toFixed(2)}`);
console.log(`Diff: ${Math.abs(arNet - feeTotalBalance).toFixed(2)} ${Math.abs(arNet - feeTotalBalance) < 0.01 ? '✅  MATCH' : '❌  MISMATCH — orphan fees inflate AR'}`);

await mongoose.disconnect();
console.log('\nDone.');
