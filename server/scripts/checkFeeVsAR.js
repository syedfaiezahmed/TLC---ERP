/**
 * Compare Fee.balanceDue with AR balance
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
const Fee = db.collection('fees');
const Ledger = db.collection('ledgers');

const fees = await Fee.find({}).sort({ feeNumber: 1 }).toArray();
console.log(`\nFee records: ${fees.length}\n`);

let totalBalanceDue = 0;
const feeDetails = [];

for (const f of fees) {
  totalBalanceDue += f.balanceDue || 0;
  feeDetails.push({
    feeNumber: f.feeNumber,
    totalAmount: f.totalAmount,
    paidAmount: f.paidAmount || 0,
    balanceDue: f.balanceDue || 0,
    payments: f.payments?.length || 0,
  });
}

console.log('Fee details:');
for (const d of feeDetails) {
  console.log(`  Fee #${d.feeNumber}: Total=${d.totalAmount}, Paid=${d.paidAmount}, Balance=${d.balanceDue}, Payments=${d.payments}`);
}

console.log(`\nTotal balanceDue from Fee model: PKR ${totalBalanceDue.toFixed(2)}`);

// Check AR by fee
const arByFee = await Ledger.aggregate([
  { $match: { accountName: 'Accounts Receivable' }},
  { $group: { _id: '$fee', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } }}
]).toArray();

console.log('\nAR by fee:');
let arTotal = 0;
for (const ar of arByFee) {
  const net = ar.debit - ar.credit;
  arTotal += net;
  const fee = fees.find(f => f._id.toString() === ar._id?.toString());
  console.log(`  Fee #${fee?.feeNumber || ar._id}: Dr=${ar.debit.toFixed(2)} Cr=${ar.credit.toFixed(2)} Net=${net.toFixed(2)} (balanceDue: ${fee?.balanceDue?.toFixed(2) || 0})`);
}

console.log(`\nTotal AR from Ledger: PKR ${arTotal.toFixed(2)}`);
console.log(`Difference: PKR ${(arTotal - totalBalanceDue).toFixed(2)}`);

await mongoose.disconnect();
