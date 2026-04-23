/**
 * REPAIR SCRIPT: Recompute fee.paidAmount, fee.writeOffAmount, fee.balanceDue, fee.status
 * from actual active FeePayment records — the single source of truth.
 *
 * Also identifies orphan fees (no voucher, no payments) for review.
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
const Fee = db.collection('fees');
const FeePayment = db.collection('feepayments');
const FeeVoucher = db.collection('feevouchers');
const Ledger = db.collection('ledgers');
const Student = db.collection('students');

// ── Build FeePayment aggregations per fee ────────────────────────────────────
const fpAgg = await FeePayment.aggregate([
  { $match: { status: 'active' } },
  {
    $group: {
      _id: '$fee',
      totalAmount: { $sum: '$amount' },
      totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
    }
  }
]).toArray();

const fpByFee = new Map(fpAgg.map(r => [String(r._id), r]));

// ── Recompute every fee ──────────────────────────────────────────────────────
const fees = await Fee.find({}).toArray();
let fixed = 0, orphans = 0;

console.log('══════════════════════════════════════════════════════════════════════');
console.log('  FEE BALANCE REPAIR');
console.log('══════════════════════════════════════════════════════════════════════\n');

for (const fee of fees) {
  const fp = fpByFee.get(String(fee._id));
  const newPaid     = fp ? fp.totalAmount   : 0;
  const newWriteOff = fp ? fp.totalDiscount : 0;
  const newBalance  = Math.max(0, Number(
    (fee.totalAmount - newPaid - newWriteOff - (fee.refundAmount || 0)).toFixed(2)
  ));
  let newStatus;
  if (newBalance <= 0.01)  newStatus = 'paid';
  else if (newPaid > 0)    newStatus = 'partial';
  else                     newStatus = 'unpaid';

  const paidDiff     = Math.abs(newPaid     - (fee.paidAmount     || 0));
  const writeDiff    = Math.abs(newWriteOff - (fee.writeOffAmount || 0));
  const balanceDiff  = Math.abs(newBalance  - (fee.balanceDue     || 0));
  const statusDiff   = newStatus !== fee.status;

  const student = await Student.findOne({ _id: fee.student });

  if (paidDiff > 0.01 || writeDiff > 0.01 || balanceDiff > 0.01 || statusDiff) {
    console.log(`Fee #${fee.feeNumber} — ${student?.name || 'Unknown'}`);
    console.log(`  BEFORE: paid=${fee.paidAmount} writeOff=${fee.writeOffAmount||0} balance=${fee.balanceDue} status=${fee.status}`);
    console.log(`  AFTER:  paid=${newPaid} writeOff=${newWriteOff} balance=${newBalance} status=${newStatus}`);

    await Fee.updateOne(
      { _id: fee._id },
      { $set: {
        paidAmount:     newPaid,
        writeOffAmount: newWriteOff,
        balanceDue:     newBalance,
        status:         newStatus,
      }}
    );
    console.log(`  ✅  Updated\n`);
    fixed++;
  }
}

if (fixed === 0) console.log('All fee balances already correct — no changes needed.\n');
else console.log(`\nRepaired ${fixed} fee records.\n`);

// ── Identify orphan fees (no voucher + no payments) ──────────────────────────
console.log('══════════════════════════════════════════════════════════════════════');
console.log('  ORPHAN FEES (no voucher, no payments — likely test/incorrect data)');
console.log('══════════════════════════════════════════════════════════════════════\n');

const feesAfter = await Fee.find({}).toArray();
for (const fee of feesAfter) {
  const vouchers = await FeeVoucher.find({ fee: fee._id }).toArray();
  const fp = fpByFee.get(String(fee._id));
  if (vouchers.length === 0 && !fp && (fee.balanceDue || 0) > 0) {
    const student = await Student.findOne({ _id: fee.student });
    const ledgerEntries = await Ledger.countDocuments({ fee: fee._id });
    console.log(`  ❌ ORPHAN: Fee #${fee.feeNumber} — ${student?.name}`);
    console.log(`     totalAmount=${fee.totalAmount}  paidAmount=${fee.paidAmount}  balanceDue=${fee.balanceDue}`);
    console.log(`     Ledger entries: ${ledgerEntries}`);
    console.log(`     ⚠️  Action needed: Delete this fee + its ${ledgerEntries} ledger entries (if test data)`);
    console.log(`        OR keep it if it represents a real outstanding receivable\n`);
    orphans++;
  }
}

if (orphans === 0) console.log('No orphan fees found.\n');

// ── Final reconciliation ────────────────────────────────────────────────────
const finalFees = await Fee.find({}).toArray();
const totalBalance = finalFees.reduce((s,f) => s + (f.balanceDue||0), 0);
const totalPaid    = finalFees.reduce((s,f) => s + (f.paidAmount||0), 0);
const totalInv     = finalFees.reduce((s,f) => s + (f.totalAmount||0), 0);

// Also check ledger AR
const arAgg = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' } },
  { $group: { _id: null, dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } }
]).toArray();
const arLedger = arAgg.length ? arAgg[0].dr - arAgg[0].cr : 0;

console.log('══════════════════════════════════════════════════════════════════════');
console.log('  FINAL RECONCILIATION');
console.log('══════════════════════════════════════════════════════════════════════');
console.log(`  Fees: ${finalFees.length}  |  Invoiced: ${totalInv}  |  Paid: ${totalPaid}  |  Balance: ${totalBalance}`);
console.log(`  AR Ledger:  PKR ${arLedger.toFixed(2)}`);
console.log(`  Fee Balance: PKR ${totalBalance.toFixed(2)}`);
console.log(`  Diff: ${Math.abs(arLedger - totalBalance).toFixed(2)} ${Math.abs(arLedger - totalBalance) < 0.01 ? '✅' : '❌ MISMATCH'}`);

await mongoose.disconnect();
console.log('\nDone.');
