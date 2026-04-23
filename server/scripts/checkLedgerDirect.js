/**
 * Direct check of Ledger entries
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

console.log('\nChecking Ledger entries...\n');

// Count all ledger entries
const totalCount = await Ledger.countDocuments();
console.log(`Total Ledger entries: ${totalCount}`);

// Count by accountName
const byAccount = await Ledger.aggregate([
  { $group: { _id: '$accountName', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();
console.log('\nBy accountName:');
for (const row of byAccount) {
  console.log(`  ${row._id}: ${row.count}`);
}

// Check Fee Revenue specifically
const feeRevenueEntries = await Ledger.find({ accountName: 'Fee Revenue' }).toArray();
console.log(`\nFee Revenue entries: ${feeRevenueEntries.length}`);
if (feeRevenueEntries.length === 0) {
  console.log('❌ NO FEE REVENUE ENTRIES IN LEDGER');
} else {
  console.log('First 5:');
  for (const e of feeRevenueEntries.slice(0, 5)) {
    console.log(`  ${e.date.toISOString().split('T')[0]} | ${e.referenceType} | Cr:${e.credit} Dr:${e.debit}`);
  }
}

// Check Accounts Receivable
const arEntries = await Ledger.find({ accountName: 'Accounts Receivable' }).toArray();
console.log(`\nAccounts Receivable entries: ${arEntries.length}`);
if (arEntries.length === 0) {
  console.log('❌ NO AR ENTRIES IN LEDGER');
}

// Check recent entries
const recent = await Ledger.find({}).sort({ createdAt: -1 }).limit(10).toArray();
console.log('\nLast 10 Ledger entries:');
for (const e of recent) {
  console.log(`  ${e.createdAt.toISOString().split('T')[0]} | ${e.accountName} | ${e.referenceType} | Cr:${e.credit} Dr:${e.debit}`);
}

await mongoose.disconnect();
