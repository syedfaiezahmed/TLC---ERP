/**
 * CA Audit: Dashboard Fees vs Actual Fee Records
 * Compares dashboard totals with Fee model, FeePayment, and Ledger
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
const FeePayment = db.collection('feepayments');
const FeeVoucher = db.collection('feevouchers');

// Get company ID from first fee
const firstFee = await Fee.findOne({});
if (!firstFee) { console.log('No fees found'); process.exit(0); }
const companyId = firstFee.company.toString();
console.log(`Using Company ID: ${companyId}\n`);

const companyObjectId = new mongoose.Types.ObjectId(companyId);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('CA AUDIT: DASHBOARD FEES VS ACTUAL DATA');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. Dashboard Fee Revenue (from Ledger)
const feeRevenueLedger = await Ledger.aggregate([
  { $match: { company: companyObjectId, accountName: 'Fee Revenue' }},
  { $group: { _id: null, total: { $sum: { $subtract: ["$credit", "$debit"] } } } }
]).toArray();
console.log(`DEBUG: feeRevenueLedger length: ${feeRevenueLedger.length}`);
if (feeRevenueLedger.length > 0) console.log(`DEBUG: first result total: ${feeRevenueLedger[0].total}`);
const dashboardFeeRevenue = feeRevenueLedger.length > 0 ? feeRevenueLedger[0].total : 0;

// 1b. Total Revenue (all revenue accounts including Late Fee)
const totalRevenueLedger = await Ledger.aggregate([
  { $match: { company: companyObjectId, accountType: 'revenue' }},
  { $group: { _id: null, total: { $sum: { $subtract: ["$credit", "$debit"] } } } }
]).toArray();
const dashboardTotalRevenue = totalRevenueLedger.length > 0 ? totalRevenueLedger[0].total : 0;

// 2. Total Invoiced Fees (from Fee model)
const fees = await Fee.find({}).toArray();
const totalInvoiced = fees.reduce((sum, f) => sum + (f.totalAmount || 0), 0);

// 3. Total Collected via FeePayment (voucher system)
const payments = await FeePayment.find({}).toArray();
const totalCollectedVoucher = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

// 4. Total Collected via Fee.payments[] (embedded payments)
const totalCollectedEmbedded = fees.reduce((sum, f) => {
  const pmts = f.payments || [];
  return sum + pmts.reduce((ps, p) => ps + (p.amount || 0), 0);
}, 0);

// 5. Ledger Fee Revenue breakdown by type
const revenueByType = await Ledger.aggregate([
  { $match: { company: companyObjectId, accountName: 'Fee Revenue' }},
  { $group: { _id: '$referenceType', credit: { $sum: '$credit' }, debit: { $sum: '$debit' } }}
]).toArray();

// 6. Ledger Accounts Receivable
const arLedger = await Ledger.aggregate([
  { $match: { company: companyObjectId, accountName: 'Accounts Receivable' }},
  { $group: { _id: null, total: { $sum: { $subtract: ["$debit", "$credit"] } } } }
]).toArray();
const arBalance = arLedger.length > 0 ? arLedger[0].total : 0;

// 7. Outstanding fees (balanceDue)
const outstandingFees = fees.reduce((sum, f) => sum + (f.balanceDue || 0), 0);

console.log('📊 DASHBOARD TOTALS (from Ledger):');
console.log(`   Total Revenue:       PKR ${dashboardTotalRevenue.toFixed(2)} (incl. Late Fee)`);
console.log(`   Fee Revenue:         PKR ${dashboardFeeRevenue.toFixed(2)}`);
console.log(`   Late Fee Revenue:    PKR ${(dashboardTotalRevenue - dashboardFeeRevenue).toFixed(2)}`);
console.log(`   Accounts Receivable: PKR ${arBalance.toFixed(2)}`);

console.log('\n📋 ACTUAL FEE RECORDS:');
console.log(`   Total Fees (count):      ${fees.length}`);
console.log(`   Total Invoiced:          PKR ${totalInvoiced.toFixed(2)}`);
console.log(`   Outstanding (balanceDue): PKR ${outstandingFees.toFixed(2)}`);

console.log('\n💰 COLLECTIONS:');
console.log(`   Via Vouchers (FeePayment):     PKR ${totalCollectedVoucher.toFixed(2)} (${payments.length} payments)`);
console.log(`   Via Embedded (Fee.payments[]):  PKR ${totalCollectedEmbedded.toFixed(2)}`);
console.log(`   Total Collected:                PKR ${(totalCollectedVoucher + totalCollectedEmbedded).toFixed(2)}`);

console.log('\n📝 LEDGER FEE REVENUE BY TYPE:');
if (revenueByType && revenueByType.length > 0) {
  for (const row of revenueByType) {
    const net = row.credit - row.debit;
    console.log(`   ${row._id}: Cr=${row.credit.toFixed(2)} Dr=${row.debit.toFixed(2)} Net=${net.toFixed(2)}`);
  }
} else {
  console.log('   No Fee Revenue entries found in Ledger');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DISCREPANCY ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════');

const revenueVsInvoiced = dashboardFeeRevenue - totalInvoiced;
console.log(`\n1. Dashboard Fee Revenue vs Total Invoiced:`);
console.log(`   Difference: PKR ${revenueVsInvoiced.toFixed(2)}`);
if (Math.abs(revenueVsInvoiced) > 1) {
  console.log(`   ⚠️  MISMATCH - Dashboard shows ${(revenueVsInvoiced > 0 ? 'MORE' : 'LESS')} than invoiced`);
} else {
  console.log(`   ✅  MATCH`);
}

const arVsOutstanding = arBalance - outstandingFees;
console.log(`\n2. Accounts Receivable vs Outstanding Fees:`);
console.log(`   Difference: PKR ${arVsOutstanding.toFixed(2)}`);
if (Math.abs(arVsOutstanding) > 1) {
  console.log(`   ⚠️  MISMATCH - Ledger AR shows ${(arVsOutstanding > 0 ? 'MORE' : 'LESS')} than fee balanceDue`);
} else {
  console.log(`   ✅  MATCH`);
}

const collectedVsPayments = (totalCollectedVoucher + totalCollectedEmbedded) - (totalInvoiced - outstandingFees);
console.log(`\n3. Total Collected vs (Invoiced - Outstanding):`);
console.log(`   Total Collected:           PKR ${(totalCollectedVoucher + totalCollectedEmbedded).toFixed(2)}`);
console.log(`   Invoiced - Outstanding:    PKR ${(totalInvoiced - outstandingFees).toFixed(2)}`);
console.log(`   Difference:                PKR ${collectedVsPayments.toFixed(2)}`);
if (Math.abs(collectedVsPayments) > 1) {
  console.log(`   ⚠️  MISMATCH`);
} else {
  console.log(`   ✅  MATCH`);
}

// 4. Check for fees without accrual entries
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DATA INTEGRITY CHECKS');
console.log('═══════════════════════════════════════════════════════════════\n');

let feesWithoutAccrual = 0;
for (const f of fees) {
  const accrual = await Ledger.findOne({
    referenceType: 'fee',
    fee: f._id,
    accountName: 'Fee Revenue',
    credit: { $gt: 0 }
  });
  if (!accrual) {
    feesWithoutAccrual++;
    console.log(`   ⚠️  Fee #${f.feeNumber} (PKR ${f.totalAmount}) has NO accrual entry`);
  }
}
console.log(`\n   Fees without accrual entries: ${feesWithoutAccrual} / ${fees.length}`);
if (feesWithoutAccrual === 0) console.log(`   ✅  All fees have accrual entries`);

// 5. Check for double-posted fees
const feeIds = new Set();
let duplicateFees = 0;
for (const entry of await Ledger.find({ accountName: 'Fee Revenue', referenceType: 'fee' }).toArray()) {
  if (feeIds.has(entry.fee?.toString())) {
    duplicateFees++;
    console.log(`   ⚠️  Duplicate accrual entry for fee ${entry.fee}`);
  }
  feeIds.add(entry.fee?.toString());
}
console.log(`\n   Duplicate accrual entries: ${duplicateFees}`);
if (duplicateFees === 0) console.log(`   ✅  No duplicate accrual entries`);

await mongoose.disconnect();
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('AUDIT COMPLETE');
console.log('═══════════════════════════════════════════════════════════════\n');
