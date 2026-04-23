/**
 * Check actual payment amounts from FeePayment model
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
const FeePayment = db.collection('feepayments');
const Ledger = db.collection('ledgers');

const payments = await FeePayment.find({}).toArray();
const totalFromPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

console.log(`\nFeePayment records: ${payments.length}`);
console.log(`Total from FeePayment model: PKR ${totalFromPayments.toFixed(2)}`);

// Check ledger fee_payment entries
const ledgerFeePayment = await Ledger.find({ referenceType: 'fee_payment', accountName: 'Fee Revenue' }).toArray();
const totalFromLedger = ledgerFeePayment.reduce((sum, e) => sum + (e.credit || 0), 0);

console.log(`\nLedger fee_payment entries: ${ledgerFeePayment.length}`);
console.log(`Total from Ledger fee_payment entries: PKR ${totalFromLedger.toFixed(2)}`);

console.log(`\nDifference: PKR ${(totalFromLedger - totalFromPayments).toFixed(2)}`);

await mongoose.disconnect();
