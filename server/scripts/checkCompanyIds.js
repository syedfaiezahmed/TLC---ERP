/**
 * Check company ID mismatch between Fees and Ledger entries
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
const Fee = db.collection('fees');
const Company = db.collection('companies');

console.log('\nChecking company IDs...\n');

// Get all companies
const companies = await Company.find({}).toArray();
console.log(`Total companies: ${companies.length}`);
for (const c of companies) {
  console.log(`  Company ID: ${c._id} | Name: ${c.name}`);
}

// Check fee company IDs
const fees = await Fee.find({}).toArray();
const feeCompanies = new Set();
for (const f of fees) {
  feeCompanies.add(f.company?.toString());
}
console.log(`\nFee company IDs: ${Array.from(feeCompanies).join(', ')}`);

// Check ledger company IDs
const ledgerCompanies = await Ledger.distinct('company');
console.log(`Ledger company IDs: ${ledgerCompanies.join(', ')}`);

// Check Fee Revenue entries by company
const feeRevenueByCompany = await Ledger.aggregate([
  { $match: { accountName: 'Fee Revenue' }},
  { $group: { _id: '$company', credit: { $sum: '$credit' }, debit: { $sum: '$debit' } }}
]).toArray();
console.log('\nFee Revenue by company:');
for (const row of feeRevenueByCompany) {
  const net = row.credit - row.debit;
  console.log(`  Company ${row._id}: Cr=${row.credit.toFixed(2)} Dr=${row.debit.toFixed(2)} Net=${net.toFixed(2)}`);
}

await mongoose.disconnect();
