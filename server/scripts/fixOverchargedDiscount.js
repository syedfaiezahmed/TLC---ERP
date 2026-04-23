/**
 * Fix: PAY-2026-000003 (Umrah Adnan) had a late-fee-waiver stored as discountAmount=200
 * but the fee was already fully paid with cash (amount=1000 = totalAmount=1000).
 * The Cr AR 200 we posted is WRONG — revert it and reset fee.writeOffAmount=0.
 *
 * PAY-2026-000004 (Nabeeha Ahmed, discount=300) is legitimate — keep it.
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
const Fee = db.collection('fees');
const Ledger = db.collection('ledgers');

// ── Find all FeePayments with discounts and check if the discount is real ───
const discountedPayments = await FeePayment.find({ status: 'active', discountAmount: { $gt: 0 } }).toArray();

for (const fp of discountedPayments) {
  if (!fp.fee) continue;

  const fee = await Fee.findOne({ _id: fp.fee });
  if (!fee) continue;

  const cashPaid   = fp.amount;               // cash actually received
  const discount   = fp.discountAmount || 0;
  const totalAmount = fee.totalAmount;

  // GENUINE discount: cash + discount = totalAmount (discount makes up the shortfall)
  const isGenuineDiscount = Math.abs((cashPaid + discount) - totalAmount) < 0.01;
  // SPURIOUS discount: cash alone >= totalAmount (discount is a late-fee waiver, not a price reduction)
  const isSpuriousDiscount = cashPaid >= totalAmount - 0.01;

  console.log(`Payment ${fp.paymentNumber}: amount=${cashPaid} discount=${discount} fee.totalAmount=${totalAmount}`);
  console.log(`  Genuine discount: ${isGenuineDiscount}  |  Spurious (late fee waiver): ${isSpuriousDiscount}`);

  if (isSpuriousDiscount && !isGenuineDiscount) {
    console.log(`  ➡️  SPURIOUS — deleting incorrect discount ledger entries...`);

    // Delete the DISC- ledger entries we incorrectly posted
    const del = await Ledger.deleteMany({
      company: fp.company,
      referenceId: fp._id,
      referenceType: 'adjustment',
      accountName: { $in: ['Scholarship/Discount', 'Accounts Receivable'] },
      $or: [
        { reference: { $regex: `^DISC-${fp._id}` } },
        { reference: { $regex: `^DISC-AR-${fp._id}` } },
      ]
    });
    console.log(`  Deleted ${del.deletedCount} ledger entries`);

    // Revert fee.writeOffAmount back to 0 for this fee (discount was not real)
    const updResult = await Fee.updateOne(
      { _id: fp.fee },
      { $set: { writeOffAmount: 0 } }
    );
    console.log(`  Reset fee #${fee.feeNumber} writeOffAmount → 0  (modifiedCount=${updResult.modifiedCount})`);
    console.log(`  ✅  Reverted\n`);
  } else if (isGenuineDiscount) {
    console.log(`  ✅  Genuine discount — keeping ledger entries\n`);
  }
}

// ── Final state ──────────────────────────────────────────────────────────────
const allFees = await Fee.find({}).toArray();
const feeBalance = allFees.reduce((s, f) => s + (f.balanceDue || 0), 0);

const arAgg = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' } },
  { $group: { _id: null, dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } }
]).toArray();
const arNet = arAgg.length ? arAgg[0].dr - arAgg[0].cr : 0;

const ledgerTotals = await Ledger.aggregate([
  { $group: { _id: null, totalCr: { $sum: '$credit' }, totalDr: { $sum: '$debit' } } }
]).toArray();

const totalCr = ledgerTotals[0]?.totalCr || 0;
const totalDr = ledgerTotals[0]?.totalDr || 0;

console.log('══════════════════════════════════════════════════════════════════════');
console.log('  FINAL STATE');
console.log('══════════════════════════════════════════════════════════════════════');
console.log(`  AR Ledger:   PKR ${arNet.toFixed(2)}`);
console.log(`  Fee Balance: PKR ${feeBalance.toFixed(2)}`);
console.log(`  Match: ${Math.abs(arNet - feeBalance) < 0.01 ? '✅' : '❌ DIFF=' + Math.abs(arNet - feeBalance).toFixed(2)}`);
console.log(`\n  Double Entry: Cr=${totalCr.toFixed(2)}  Dr=${totalDr.toFixed(2)}  Diff=${Math.abs(totalCr-totalDr).toFixed(2)} ${Math.abs(totalCr-totalDr) < 0.01 ? '✅ BALANCED' : '❌'}`);

await mongoose.disconnect();
console.log('\nDone.');
