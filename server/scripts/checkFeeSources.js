/**
 * Check which fees were created by feeController vs auto-created by voucher system
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
const FeePayment = db.collection('feepayments');
const Ledger = db.collection('ledgers');

const fees = await Fee.find({}).sort({ date: 1 }).toArray();
console.log(`\nTotal Fee records: ${fees.length}\n`);

let autoCreated = 0;
let manuallyCreated = 0;

for (const f of fees) {
  // Check if fee has a linked FeePayment (auto-created)
  const linkedPayment = await FeePayment.findOne({ fee: f._id });
  // Check if fee has accrual journal entry
  const accrualEntry = await Ledger.findOne({
    referenceType: 'fee',
    fee: f._id,
    accountName: 'Fee Revenue',
    credit: { $gt: 0 }
  });

  const isAutoCreated = !!linkedPayment;
  if (isAutoCreated) autoCreated++;
  else manuallyCreated++;

  console.log(`Fee #${f.feeNumber} | Date: ${f.date.toISOString().split('T')[0]} | Amount: PKR ${f.totalAmount} | ${isAutoCreated ? 'AUTO-CREATED (by voucher)' : 'MANUAL (feeController)'} | Accrual Entry: ${accrualEntry ? 'YES' : 'NO'}`);
}

console.log(`\nAuto-created by voucher: ${autoCreated}`);
console.log(`Manually created by feeController: ${manuallyCreated}`);

await mongoose.disconnect();
