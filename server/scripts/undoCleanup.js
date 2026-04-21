/**
 * Undo cleanup — reverse the reversal entries to restore original voucher payment credits
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

// Find all cleanup reversal entries and reverse them back
const cleanupEntries = await Ledger.find({
  referenceType: 'adjustment',
  description: { $regex: 'Cleanup' },
}).toArray();

console.log(`Found ${cleanupEntries.length} cleanup entries to reverse.`);

let reversed = 0;
for (const entry of cleanupEntries) {
  if (entry.debit > 0) {
    // This is a Fee Revenue debit (reversal) — restore the original credit
    await Ledger.insertOne({
      company:       entry.company,
      student:       entry.student,
      fee:           entry.fee,
      referenceType: 'fee_payment',
      referenceId:   entry.referenceId,
      reference:     `RESTORE-${entry._id}`,
      journalId:     entry.journalId,
      date:          new Date(),
      description:   `[Restore] Undo cleanup — restore original Fee Revenue credit`,
      debit:         0,
      credit:        entry.debit,
      type:          'fee_payment',
      accountName:   'Fee Revenue',
      accountType:   'revenue',
      relatedAccount:'Cash',
      balance:       0,
      createdAt:     new Date(),
      updatedAt:     new Date(),
    });
    reversed++;
  }
}

console.log(`Restored ${reversed} Fee Revenue credits.`);

// Now delete the cleanup entries
const deleteResult = await Ledger.deleteMany({
  referenceType: 'adjustment',
  description: { $regex: 'Cleanup' },
});

console.log(`Deleted ${deleteResult.deletedCount} cleanup adjustment entries.`);

console.log('\n───── VERIFY ─────');
const revenueEntries = await Ledger.find({ accountName: 'Fee Revenue' }).toArray();
let totalCredit = 0;
let totalDebit = 0;
for (const e of revenueEntries) {
  totalCredit += e.credit || 0;
  totalDebit += e.debit || 0;
}
console.log(`Total Fee Revenue entries: ${revenueEntries.length}`);
console.log(`Net Fee Revenue: PKR ${(totalCredit - totalDebit).toFixed(2)}`);

await mongoose.disconnect();
console.log('Done.');
