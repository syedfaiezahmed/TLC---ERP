/**
 * Fix missing Cash/Bank Dr entries for SETTLE- adjustment ledger entries.
 * Each SETTLE- (Cr AR) needs a corresponding Dr Cash entry to balance double-entry.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅  MongoDB connected');

const db = mongoose.connection;
const Ledger = db.collection('ledgers');
const FeePayment = db.collection('feepayments');

// Find all SETTLE- adjustment entries (Cr AR, no Dr Cash counterpart)
const settleEntries = await Ledger.find({
  accountName: 'Accounts Receivable',
  referenceType: 'adjustment',
  reference: { $regex: '^SETTLE-' },
  credit: { $gt: 0 },
}).toArray();

console.log(`Found ${settleEntries.length} SETTLE- entries needing Cash counterpart.\n`);

let added = 0;
for (const entry of settleEntries) {
  try {
    // Check if Cash/Bank entry already exists for this journalId
    const existing = await Ledger.findOne({
      journalId: entry.journalId,
      accountName: { $in: ['Cash', 'Bank'] },
      debit: { $gt: 0 },
    });

    if (existing) {
      console.log(`  Already exists for ${entry.reference}`);
      continue;
    }

    // Find the FeePayment to determine payment method
    let paymentMethod = 'Cash';
    if (entry.referenceId) {
      const fp = await FeePayment.findOne({ _id: entry.referenceId });
      if (fp) paymentMethod = fp.paymentMethod || 'Cash';
    }

    const cashAccount = (paymentMethod === 'Bank Transfer' || paymentMethod === 'Cheque' || paymentMethod === 'Online') ? 'Bank' : 'Cash';

    // Insert the Dr Cash/Bank entry
    await Ledger.insertOne({
      company: entry.company,
      student: entry.student,
      fee: entry.fee,
      referenceType: 'adjustment',
      referenceId: entry.referenceId,
      reference: entry.reference.replace('SETTLE-', 'CASH-'),
      journalId: entry.journalId,
      date: entry.date,
      description: entry.description,
      debit: entry.credit,
      credit: 0,
      type: 'adjustment',
      accountName: cashAccount,
      accountType: 'asset',
      relatedAccount: 'Accounts Receivable',
      balance: 0,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });

    console.log(`✅  Added Dr ${cashAccount} ${entry.credit} for ${entry.reference}`);
    added++;
  } catch (err) {
    console.error(`❌  Error for ${entry.reference}:`, err.message);
  }
}

console.log(`\nAdded ${added} Cash/Bank Dr entries.\n`);

// Verify double-entry balance
const totals = await Ledger.aggregate([
  { $group: { _id: null, totalCredit: { $sum: '$credit' }, totalDebit: { $sum: '$debit' } } }
]).toArray();

if (totals.length > 0) {
  const diff = Math.abs(totals[0].totalCredit - totals[0].totalDebit);
  console.log(`Total Credits: PKR ${totals[0].totalCredit.toFixed(2)}`);
  console.log(`Total Debits:  PKR ${totals[0].totalDebit.toFixed(2)}`);
  console.log(`Difference:    PKR ${diff.toFixed(2)} ${diff < 0.01 ? '✅  BALANCED' : '❌  STILL OUT OF BALANCE'}`);
}

// Show full account summary
const byAccount = await Ledger.aggregate([
  { $group: { _id: '$accountName', credit: { $sum: '$credit' }, debit: { $sum: '$debit' } } },
  { $sort: { _id: 1 } }
]).toArray();

console.log('\nAccount Summary:');
for (const a of byAccount) {
  const net = a.credit - a.debit;
  console.log(`  ${a._id.padEnd(30)} Cr=${a.credit.toFixed(2).padStart(10)}  Dr=${a.debit.toFixed(2).padStart(10)}  Net=${net.toFixed(2).padStart(10)}`);
}

await mongoose.disconnect();
console.log('\nDone.');
