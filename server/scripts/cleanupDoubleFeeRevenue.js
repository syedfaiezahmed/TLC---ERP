/**
 * One-time cleanup script — reverse duplicate Fee Revenue credits.
 *
 * Run:  node --env-file=.env scripts/cleanupDoubleFeeRevenue.js
 *
 * What it does:
 *   1. Finds every FeePayment that links to a pre-existing Fee record.
 *   2. For each, finds any Ledger entry where:
 *        accountName = 'Fee Revenue'  AND  credit > 0
 *        AND  referenceType IN ('fee_payment', 'payment', 'voucher_payment')
 *        that was posted for that fee/payment (i.e. the duplicate revenue credit).
 *   3. Reverses it:  Dr Fee Revenue / Cr Accounts Receivable  (contra pair).
 *
 * Safe: only ADDS reversal entries — never deletes anything.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌  MONGO_URI not set in .env'); process.exit(1); }

await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅  MongoDB connected');

const db = mongoose.connection;
const Ledger      = db.collection('ledgers');
const FeePayment  = db.collection('feepayments');

// ── 1. Find all FeePayments that link to a pre-existing Fee ────────────────
const linkedPayments = await FeePayment.find({ fee: { $exists: true, $ne: null } }).toArray();
console.log(`Found ${linkedPayments.length} linked FeePayment records to check.`);

let purged = 0;
let skipped = 0;
const errors = [];

for (const pmt of linkedPayments) {
  try {
    const feeObjId = typeof pmt.fee === 'string' ? new mongoose.Types.ObjectId(pmt.fee) : pmt.fee;

    // Find bad Ledger entries: Fee Revenue credited as part of a payment journal
    // (the accrual credit at invoice time has referenceType 'fee', not 'fee_payment')
    const bad = await Ledger.find({
      company: pmt.company,
      accountName: 'Fee Revenue',
      credit:      { $gt: 0 },
      referenceType: { $in: ['fee_payment', 'payment', 'voucher_payment'] },
      $or: [
        { fee: feeObjId },
        { referenceId: pmt._id },
      ],
    }).toArray();

    if (bad.length === 0) { skipped++; continue; }

    for (const entry of bad) {
      // Check: is there already a cleanup reversal for this entry?
      const already = await Ledger.findOne({
        reference: `CLEANUP-REV-${entry._id}`,
      });
      if (already) { console.log(`  ⏭  Already reversed: ${entry._id}`); skipped++; continue; }

      const now = new Date();
      const jId = `cleanup-${entry._id}`;

      // Reversal: Dr Fee Revenue  (removes the duplicate income)
      await Ledger.insertOne({
        company:       entry.company,
        student:       entry.student   || null,
        fee:           entry.fee       || null,
        referenceType: 'adjustment',
        referenceId:   entry._id,
        reference:     `CLEANUP-REV-${entry._id}`,
        journalId:     jId,
        date:          now,
        description:   `[Cleanup] Reverse duplicate Fee Revenue — orig ${entry._id}`,
        debit:         entry.credit,
        credit:        0,
        type:          'adjustment',
        accountName:   'Fee Revenue',
        accountType:   'revenue',
        relatedAccount:'Accounts Receivable',
        balance:       0,
        createdAt:     now,
        updatedAt:     now,
      });

      // Counter-entry: Cr Accounts Receivable  (records the correct AR settlement)
      await Ledger.insertOne({
        company:       entry.company,
        student:       entry.student   || null,
        fee:           entry.fee       || null,
        referenceType: 'adjustment',
        referenceId:   entry._id,
        reference:     `CLEANUP-AR-${entry._id}`,
        journalId:     jId,
        date:          now,
        description:   `[Cleanup] Restore AR settlement — orig ${entry._id}`,
        debit:         0,
        credit:        entry.credit,
        type:          'adjustment',
        accountName:   'Accounts Receivable',
        accountType:   'asset',
        relatedAccount:'Fee Revenue',
        balance:       0,
        createdAt:     now,
        updatedAt:     now,
      });

      console.log(`  ✅  Reversed entry ${entry._id}  PKR ${entry.credit}  student: ${entry.student}`);
      purged++;
    }
  } catch (err) {
    errors.push({ paymentId: pmt._id, error: err.message });
    console.error(`  ❌  Error for payment ${pmt._id}:`, err.message);
  }
}

console.log('\n─────────────────────────────────────────────');
console.log(`Duplicate Fee Revenue credits reversed : ${purged}`);
console.log(`Payments with no bad entry (skipped)   : ${skipped}`);
console.log(`Errors                                 : ${errors.length}`);
if (errors.length) console.error('Errors:', errors);
console.log('─────────────────────────────────────────────');

await mongoose.disconnect();
console.log('🔌  Disconnected. Done.');
