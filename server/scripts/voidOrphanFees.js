/**
 * CA-CORRECT: Void the 2 orphan fee records (no voucher, no payments).
 *
 * Accounting treatment (double-entry, no deletion, full audit trail):
 *   ORIGINAL (on fee creation):  Dr Accounts Receivable  / Cr Fee Revenue
 *   REVERSAL (this script):       Dr Fee Revenue          / Cr Accounts Receivable
 *   NET:                          Zero — as if the invoice was never raised
 *
 * Fee record is marked cancelled (not deleted). Ledger entries preserved.
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
const Fee    = db.collection('fees');
const FeePayment = db.collection('feepayments');
const FeeVoucher = db.collection('feevouchers');
const Ledger = db.collection('ledgers');
const Student = db.collection('students');

// ── Identify orphan fees (no voucher, no active payments, balanceDue > 0) ───
const fees = await Fee.find({ status: { $ne: 'cancelled' } }).toArray();

const orphans = [];
for (const fee of fees) {
  const vouchers  = await FeeVoucher.find({ fee: fee._id }).toArray();
  const fpCount   = await FeePayment.countDocuments({ fee: fee._id, status: 'active' });
  if (vouchers.length === 0 && fpCount === 0 && (fee.balanceDue || 0) > 0.01) {
    const student = await Student.findOne({ _id: fee.student });
    orphans.push({ fee, student });
  }
}

console.log(`Found ${orphans.length} orphan fee(s) to void:\n`);

for (const { fee, student } of orphans) {
  console.log(`  Fee #${fee.feeNumber} — ${student?.name || 'Unknown'}  PKR ${fee.totalAmount}`);
}

if (orphans.length === 0) {
  console.log('Nothing to void.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log('\nPosting CA-correct reversal entries...\n');

for (const { fee, student } of orphans) {
  const companyId = fee.company;
  const studentId = fee.student;
  const amount    = fee.totalAmount;
  const subTotal  = fee.subTotal || amount;
  const taxAmount = fee.taxAmount || 0;
  const journalId = new mongoose.Types.ObjectId().toString();
  const date      = new Date();
  const description = `VOID: Fee Receipt #${fee.feeNumber} — ${student?.name} (incorrectly entered, no payment received)`;

  // Reversal: Dr Fee Revenue / Cr AR (and reverse tax if any)
  const lines = [
    {
      company:       companyId,
      student:       studentId,
      fee:           fee._id,
      referenceType: 'fee_void',
      referenceId:   fee._id,
      reference:     `VOID-${fee.feeNumber}`,
      journalId,
      date,
      description,
      debit:         subTotal,
      credit:        0,
      type:          'fee_void',
      accountName:   'Fee Revenue',
      accountType:   'revenue',
      relatedAccount:'Accounts Receivable',
      balance:       0,
      createdAt:     date,
      updatedAt:     date,
    },
    {
      company:       companyId,
      student:       studentId,
      fee:           fee._id,
      referenceType: 'fee_void',
      referenceId:   fee._id,
      reference:     `VOID-AR-${fee.feeNumber}`,
      journalId,
      date,
      description,
      debit:         0,
      credit:        amount,
      type:          'fee_void',
      accountName:   'Accounts Receivable',
      accountType:   'asset',
      relatedAccount:'Fee Revenue',
      balance:       0,
      createdAt:     date,
      updatedAt:     date,
    },
  ];

  // If tax was charged, reverse Tax Payable too
  if (taxAmount > 0) {
    lines.push({
      company:       companyId,
      student:       studentId,
      fee:           fee._id,
      referenceType: 'fee_void',
      referenceId:   fee._id,
      reference:     `VOID-TAX-${fee.feeNumber}`,
      journalId,
      date,
      description,
      debit:         taxAmount,
      credit:        0,
      type:          'fee_void',
      accountName:   'Tax Payable',
      accountType:   'liability',
      relatedAccount:'Accounts Receivable',
      balance:       0,
      createdAt:     date,
      updatedAt:     date,
    });
  }

  await Ledger.insertMany(lines);
  console.log(`  ✅  Reversal posted for Fee #${fee.feeNumber} (${lines.length} ledger lines, journalId=${journalId})`);

  // Mark fee as cancelled (NOT deleted — full history preserved)
  await Fee.updateOne(
    { _id: fee._id },
    { $set: {
      status:       'cancelled',
      balanceDue:   0,
      voidedAt:     date,
      voidReason:   'No voucher, no payment received — incorrectly entered fee',
    }}
  );
  console.log(`  ✅  Fee #${fee.feeNumber} marked as cancelled\n`);
}

// ── Verification ────────────────────────────────────────────────────────────
const allFees = await Fee.find({ status: { $ne: 'cancelled' } }).toArray();
const activeFees = await Fee.find({}).toArray();
const feeBalance = allFees.reduce((s,f) => s + (f.balanceDue||0), 0);

const arAgg = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' } },
  { $group: { _id: null, dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } }
]).toArray();
const arNet = arAgg.length ? arAgg[0].dr - arAgg[0].cr : 0;

const totals = await Ledger.aggregate([
  { $group: { _id: '$accountName', cr: { $sum: '$credit' }, dr: { $sum: '$debit' } } },
  { $sort: { _id: 1 } }
]).toArray();
const totalCr = totals.reduce((s,a) => s + a.cr, 0);
const totalDr = totals.reduce((s,a) => s + a.dr, 0);

console.log('══════════════════════════════════════════════════════════════════════');
console.log('  FINAL STATE AFTER VOID');
console.log('══════════════════════════════════════════════════════════════════════');
console.log('\nAccount Summary:');
for (const a of totals) {
  const net = a.cr - a.dr;
  console.log(`  ${a._id.padEnd(30)} Cr=${a.cr.toFixed(2).padStart(10)}  Dr=${a.dr.toFixed(2).padStart(10)}  Net=${net.toFixed(2).padStart(10)}`);
}
console.log(`\n  Double Entry: Cr=${totalCr.toFixed(2)}  Dr=${totalDr.toFixed(2)}  Diff=${Math.abs(totalCr-totalDr).toFixed(2)} ${Math.abs(totalCr-totalDr) < 0.01 ? '✅ BALANCED' : '❌'}`);
console.log(`\n  AR Ledger:       PKR ${arNet.toFixed(2)}`);
console.log(`  Fee Balance:     PKR ${feeBalance.toFixed(2)}`);
console.log(`  Match: ${Math.abs(arNet - feeBalance) < 0.01 ? '✅' : '❌ DIFF=' + Math.abs(arNet - feeBalance).toFixed(2)}`);
console.log(`\n  Active fees (non-cancelled): ${allFees.length} of ${activeFees.length} total`);

await mongoose.disconnect();
console.log('\nDone — audit trail fully preserved, no records deleted.');
