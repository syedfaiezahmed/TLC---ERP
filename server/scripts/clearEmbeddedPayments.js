/**
 * Clear embedded payments from Fee.payments[]
 * FeePayment is the source of truth for voucher-based payments
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

// Get fees with embedded payments
const feesWithPayments = await Fee.find({ 'payments.0': { $exists: true } }).toArray();
console.log(`\nFound ${feesWithPayments.length} fees with embedded payments.\n`);

let cleared = 0;
for (const f of feesWithPayments) {
  const paymentCount = f.payments?.length || 0;
  const totalEmbedded = f.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  
  // Clear the payments array
  await Fee.updateOne(
    { _id: f._id },
    { $set: { payments: [] } }
  );
  
  console.log(`✅  Fee #${f.feeNumber}: Cleared ${paymentCount} embedded payments (PKR ${totalEmbedded.toFixed(2)})`);
  cleared++;
}

console.log(`\nCleared embedded payments from ${cleared} fees.\n`);

// Verify FeePayment still has the data
const paymentCount = await FeePayment.countDocuments();
const paymentTotal = (await FeePayment.find({}).toArray()).reduce((sum, p) => sum + p.amount, 0);
console.log(`FeePayment records: ${paymentCount}`);
console.log(`Total in FeePayment: PKR ${paymentTotal.toFixed(2)}`);

await mongoose.disconnect();
console.log('\nDone.');
