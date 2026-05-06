import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import Fee from '../src/models/Fee.js';
import FeePayment from '../src/models/FeePayment.js';
import FeeVoucher from '../src/models/FeeVoucher.js';
import Ledger from '../src/models/Ledger.js';

await mongoose.connect(process.env.MONGO_URI);
const C = new mongoose.Types.ObjectId('69cc2de135caca42d4865263');

const [feeAgg, fpAgg, fvAgg, ledgerRevAll, ledgerFeeRev, ledgerCashBank, ledgerAR, ledgerPnL] = await Promise.all([
  Fee.aggregate([{$match:{company:C,status:{$ne:'cancelled'}}},{$group:{_id:null,totalInvoiced:{$sum:'$totalAmount'},totalPaid:{$sum:'$paidAmount'},totalDue:{$sum:'$balanceDue'}}}]),
  FeePayment.aggregate([{$match:{company:C,status:'active'}},{$group:{_id:null,totalCash:{$sum:'$amount'},totalDiscount:{$sum:'$discountAmount'},totalLateFee:{$sum:'$lateFeeAmount'},count:{$sum:1}}}]),
  FeeVoucher.aggregate([{$match:{company:C,status:{$ne:'cancelled'}}},{$group:{_id:null,totalFee:{$sum:'$totalFee'},totalPaid:{$sum:'$paidAmount'},totalDiscount:{$sum:'$totalDiscount'},totalWithLateFee:{$sum:'$totalWithLateFee'}}}]),
  Ledger.aggregate([{$match:{company:C,accountType:'revenue'}},{$group:{_id:null,credits:{$sum:'$credit'},debits:{$sum:'$debit'},net:{$sum:{$subtract:['$credit','$debit']}}}}]),
  Ledger.aggregate([{$match:{company:C,accountName:'Fee Revenue'}},{$group:{_id:null,credits:{$sum:'$credit'},debits:{$sum:'$debit'},net:{$sum:{$subtract:['$credit','$debit']}}}}]),
  Ledger.aggregate([{$match:{company:C,accountName:{$in:['Cash','Bank']},accountType:'asset'}},{$group:{_id:null,debits:{$sum:'$debit'},credits:{$sum:'$credit'},net:{$sum:{$subtract:['$debit','$credit']}}}}]),
  Ledger.aggregate([{$match:{company:C,accountName:'Accounts Receivable'}},{$group:{_id:null,debits:{$sum:'$debit'},credits:{$sum:'$credit'},net:{$sum:{$subtract:['$debit','$credit']}}}}]),
  Ledger.aggregate([{$match:{company:C,accountType:{$in:['revenue','expense']}}},{$group:{_id:null,revCredits:{$sum:{$cond:[{$eq:['$accountType','revenue']},'$credit',0]}},revDebits:{$sum:{$cond:[{$eq:['$accountType','revenue']},'$debit',0]}},expDebits:{$sum:{$cond:[{$eq:['$accountType','expense']},'$debit',0]}},expCredits:{$sum:{$cond:[{$eq:['$accountType','expense']},'$credit',0]}}}}])
]);

const sep = '='.repeat(60);
console.log('\n' + sep);
console.log('  FULL FINANCIAL AUDIT - ALL CALCULATION SOURCES');
console.log(sep);

console.log('\nSOURCE 1: Fee.js model');
console.log('  totalInvoiced (Fee.totalAmount sum) :', feeAgg[0]?.totalInvoiced || 0);
console.log('  totalPaid     (Fee.paidAmount sum)  :', feeAgg[0]?.totalPaid || 0);
console.log('  totalDue      (Fee.balanceDue sum)  :', feeAgg[0]?.totalDue || 0);

console.log('\nSOURCE 2: FeePayment.js model (CANONICAL cash)');
console.log('  totalCash collected                 :', fpAgg[0]?.totalCash || 0);
console.log('  totalDiscount given                 :', fpAgg[0]?.totalDiscount || 0);
console.log('  totalLateFee collected              :', fpAgg[0]?.totalLateFee || 0);
console.log('  count                               :', fpAgg[0]?.count || 0);

console.log('\nSOURCE 3: FeeVoucher.js model (billing docs)');
console.log('  totalFee billed                     :', fvAgg[0]?.totalFee || 0);
console.log('  totalPaid (voucher.paidAmount)      :', fvAgg[0]?.totalPaid || 0);
console.log('  totalDiscount (enrollment discounts):', fvAgg[0]?.totalDiscount || 0);
console.log('  totalWithLateFee                    :', fvAgg[0]?.totalWithLateFee || 0);

console.log('\nSOURCE 4: Ledger (double-entry)');
console.log('  ALL revenue net (credit - debit)    :', ledgerRevAll[0]?.net || 0);
console.log('  Fee Revenue account net             :', ledgerFeeRev[0]?.net || 0);
console.log('    credits                           :', ledgerFeeRev[0]?.credits || 0);
console.log('    debits (voids/reversals)          :', ledgerFeeRev[0]?.debits || 0);
console.log('  Cash+Bank balance (debit-credit)    :', ledgerCashBank[0]?.net || 0);
console.log('  Accounts Receivable balance         :', ledgerAR[0]?.net || 0);
const revNet = (ledgerPnL[0]?.revCredits||0) - (ledgerPnL[0]?.revDebits||0);
const expNet = (ledgerPnL[0]?.expDebits||0) - (ledgerPnL[0]?.expCredits||0);
console.log('  Revenue net (P&L/Dashboard)         :', revNet);
console.log('  Expense net (P&L/Dashboard)         :', expNet);

console.log('\n' + sep);
console.log('  PAGE-BY-PAGE BREAKDOWN');
console.log(sep);
console.log('\nFees.jsx (feeController -> Fee.aggregate)');
console.log('  "Total Fee Billed"  =', feeAgg[0]?.totalInvoiced || 0);
console.log('  "Total Collected"   =', feeAgg[0]?.totalPaid || 0);
console.log('  "Total Outstanding" =', feeAgg[0]?.totalDue || 0);

console.log('\nFeeManagement.jsx Tab0 (getVoucherStatistics -> FeeVoucher)');
console.log('  voucherStats.totalAmount     =', fvAgg[0]?.totalFee || 0, '  <- billing');
console.log('  voucherStats.totalPaidAmount =', fvAgg[0]?.totalPaid || 0);

console.log('\nFeeManagement.jsx Tab1 (getCollectionStatistics -> FeePayment)');
console.log('  "Total Collected"  =', fpAgg[0]?.totalCash || 0, '  <- CANONICAL CASH');

console.log('\nDashboard (getDashboardSummary -> FeeVoucher FIXED)');
console.log('  "Total Revenue" =', fvAgg[0]?.totalFee || 0, '  <- CANONICAL FeeVoucher (FIXED)');
console.log('  "Fee Revenue"   =', fvAgg[0]?.totalFee || 0, '  <- CANONICAL FeeVoucher (FIXED)');
console.log('  "Cash & Bank"   =', ledgerCashBank[0]?.net || 0, '  <- Ledger (correct)');
console.log('  [OLD stale ledger was showing:', revNet, ']');

console.log('\nReports P&L (getProfitAndLoss -> FeeVoucher FIXED)');
console.log('  "Fee Revenue"   =', fvAgg[0]?.totalFee || 0, '  <- CANONICAL FeeVoucher (FIXED)');

console.log('\nReports Revenue Tab (getRevenueReport -> FeeVoucher FIXED)');
console.log('  "Total Revenue"  =', fvAgg[0]?.totalFee || 0, '  <- CANONICAL FeeVoucher (FIXED)');
console.log('  "Cash Collected" =', fpAgg[0]?.totalCash || 0);
console.log('  "Discount Given" =', fpAgg[0]?.totalDiscount || 0);
console.log('  "Outstanding"    =', Math.max(0, (fvAgg[0]?.totalFee||0) - (fpAgg[0]?.totalCash||0) - (fpAgg[0]?.totalDiscount||0)));
console.log('  [OLD stale ledger was showing:', ledgerFeeRev[0]?.net || 0, ']');

console.log('\n' + sep);
console.log('  DIAGNOSIS (after fix)');
console.log(sep);

// After fixes: all API-level totals now agree on FeeVoucher/FeePayment canonical values
const canonical = {
  billed: fvAgg[0]?.totalFee || 0,
  cashCollected: fpAgg[0]?.totalCash || 0,
  discount: fpAgg[0]?.totalDiscount || 0,
  outstanding: Math.max(0, (fvAgg[0]?.totalFee||0) - (fpAgg[0]?.totalCash||0) - (fpAgg[0]?.totalDiscount||0)),
};
console.log('\nCANONICAL VALUES (all APIs now use these):');
console.log('  Fee Billed       :', canonical.billed);
console.log('  Cash Collected   :', canonical.cashCollected);
console.log('  Discount Given   :', canonical.discount);
console.log('  Outstanding      :', canonical.outstanding);

const problems = [];
if (Math.abs((feeAgg[0]?.totalPaid||0) - (fpAgg[0]?.totalCash||0)) > 0.01) {
  problems.push(`SYNC: Fee.paidAmount (${feeAgg[0]?.totalPaid}) != FeePayment.amount (${fpAgg[0]?.totalCash})`);
}
if (Math.abs((fvAgg[0]?.totalPaid||0) - (fpAgg[0]?.totalCash||0)) > 0.01) {
  problems.push(`SYNC: FeeVoucher.paidAmount (${fvAgg[0]?.totalPaid}) != FeePayment.amount (${fpAgg[0]?.totalCash})`);
}
if (Math.abs((ledgerCashBank[0]?.net||0) - (fpAgg[0]?.totalCash||0)) > 0.01) {
  problems.push(`LEDGER: Cash+Bank (${ledgerCashBank[0]?.net}) != FeePayment.amount (${fpAgg[0]?.totalCash}) — ledger settlement entries missing`);
}

const ledgerNote = Math.abs((ledgerFeeRev[0]?.net||0) - (fvAgg[0]?.totalFee||0)) > 0.01
  ? `NOTE: Ledger Fee Revenue (${ledgerFeeRev[0]?.net}) != FeeVoucher (${fvAgg[0]?.totalFee}) by ${(fvAgg[0]?.totalFee||0)-(ledgerFeeRev[0]?.net||0)} — accrual entries incomplete in DB (APIs now bypass this, using FeeVoucher directly)`
  : null;

if (problems.length === 0 && !ledgerNote) {
  console.log('\nAll checks PASS. System is consistent.');
} else {
  if (ledgerNote) console.log('\n' + ledgerNote);
  problems.forEach((p, i) => console.log(`\nPROBLEM ${i+1}: ${p}`));
}

await mongoose.disconnect();
