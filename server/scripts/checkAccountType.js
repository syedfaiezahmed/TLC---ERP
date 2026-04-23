/**
 * Check accountType values in Ledger
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

console.log('\nChecking accountType values in Ledger...\n');

// Check accountType distribution
const byAccountType = await Ledger.aggregate([
  { $group: { _id: '$accountType', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();
console.log('By accountType:');
for (const row of byAccountType) {
  console.log(`  ${row._id}: ${row.count}`);
}

// Check Fee Revenue entries with accountType
const feeRevenueTypes = await Ledger.aggregate([
  { $match: { accountName: 'Fee Revenue' }},
  { $group: { _id: '$accountType', count: { $sum: 1 } } }
]).toArray();
console.log('\nFee Revenue by accountType:');
for (const row of feeRevenueTypes) {
  console.log(`  ${row._id}: ${row.count}`);
}

// Check if filtering by accountType: 'revenue' works
const revenueTypeMatch = await Ledger.aggregate([
  { $match: { accountType: 'revenue' }},
  { $group: { _id: null, total: { $sum: { $subtract: ["$credit", "$debit"] } } } }
]).toArray();
console.log(`\nFiltered by accountType: 'revenue':`);
console.log(`  Total: ${revenueTypeMatch.length > 0 ? revenueTypeMatch[0].total : 0}`);

// Check all revenue accountNames
const revenueAccounts = await Ledger.distinct('accountName', { accountType: 'revenue' });
console.log(`\nAccounts with accountType: 'revenue':`);
console.log(`  ${revenueAccounts.join(', ')}`);

await mongoose.disconnect();
