/**
 * MASTER FEE SYSTEM AUDIT
 * Senior CA-level deep audit: every number must reconcile
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

const db = mongoose.connection;
const Fee = db.collection('fees');
const FeePayment = db.collection('feepayments');
const FeeVoucher = db.collection('feevouchers');
const Ledger = db.collection('ledgers');

const SEP = '═'.repeat(70);
const sep = '─'.repeat(70);

console.log(`\n${SEP}`);
console.log('  MASTER FEE SYSTEM AUDIT — Senior CA Level');
console.log(`${SEP}\n`);

// ──────────────────────────────────────────────────────────────
// 1. FEE MODEL INTEGRITY
// ──────────────────────────────────────────────────────────────
console.log('1. FEE MODEL INTEGRITY\n' + sep);

const fees = await Fee.find({}).toArray();
const fps  = await FeePayment.find({ status: 'active' }).toArray();
const fvs  = await FeeVoucher.find({}).toArray();

let issues = [];

// Build FeePayment sum per fee
const feePaymentByFee = {};
for (const p of fps) {
  if (!p.fee) continue;
  const k = p.fee.toString();
  feePaymentByFee[k] = (feePaymentByFee[k] || 0) + p.amount;
}

// Build FeePayment sum per voucher
const feePaymentByVoucher = {};
for (const p of fps) {
  if (!p.voucher) continue;
  const k = p.voucher.toString();
  feePaymentByVoucher[k] = (feePaymentByVoucher[k] || 0) + p.amount;
}

let totalInvoiced = 0, totalPaid = 0, totalBalance = 0;

for (const f of fees) {
  totalInvoiced += f.totalAmount || 0;
  totalPaid     += f.paidAmount  || 0;
  totalBalance  += f.balanceDue  || 0;

  // Correct formula: totalAmount = paidAmount + writeOffAmount + refundAmount + balanceDue
  const writeOff = f.writeOffAmount  || 0;
  const refund   = f.refundAmount    || 0;
  const paid     = f.paidAmount      || 0;
  const balance  = f.balanceDue      || 0;
  const computed = paid + writeOff + refund + balance;
  const diff     = Math.abs(computed - f.totalAmount);

  if (diff > 0.01) {
    issues.push(`❌ Fee #${f.feeNumber}: totalAmount=${f.totalAmount} but paid(${paid})+writeOff(${writeOff})+refund(${refund})+balance(${balance})=${computed.toFixed(2)} DIFF=${diff.toFixed(2)}`);
  }

  // Check paidAmount vs FeePayment collection
  const fpPaid = feePaymentByFee[f._id.toString()] || 0;
  const embeddedPaid = (f.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  
  if (Math.abs(fpPaid - paid) > 0.01) {
    issues.push(`⚠️  Fee #${f.feeNumber}: fee.paidAmount=${paid} but FeePayment total=${fpPaid.toFixed(2)} (diff=${Math.abs(fpPaid-paid).toFixed(2)})`);
  }
  if (embeddedPaid > 0) {
    issues.push(`⚠️  Fee #${f.feeNumber}: has ${f.payments.length} embedded payments (total ${embeddedPaid}) — should be 0 (FeePayment is source of truth)`);
  }
}

console.log(`Fees: ${fees.length}  |  Total Invoiced: PKR ${totalInvoiced.toFixed(2)}  |  Total Paid: PKR ${totalPaid.toFixed(2)}  |  Total Balance: PKR ${totalBalance.toFixed(2)}`);
console.log(`Formula check: Invoiced(${totalInvoiced.toFixed(2)}) = Paid(${totalPaid.toFixed(2)}) + Balance(${totalBalance.toFixed(2)}) + WriteOff?`);
const delta = Math.abs(totalInvoiced - totalPaid - totalBalance);
console.log(`Balance sheet diff: ${delta.toFixed(2)} ${delta < 0.01 ? '✅' : '⚠️  MISMATCH'}\n`);

if (issues.length) issues.forEach(i => console.log(i));
else console.log('✅  All fee records balance correctly\n');
issues = [];

// ──────────────────────────────────────────────────────────────
// 2. FEEPAYMENT COLLECTION INTEGRITY
// ──────────────────────────────────────────────────────────────
console.log('\n2. FEEPAYMENT COLLECTION\n' + sep);

const allFps = await FeePayment.find({}).toArray();
const activeFps  = allFps.filter(p => p.status === 'active');
const cancelledFps = allFps.filter(p => p.status === 'cancelled');
const refundedFps  = allFps.filter(p => p.status === 'refunded');

const totalActiveAmount   = activeFps.reduce((s, p) => s + p.amount, 0);
const totalCancelledAmount = cancelledFps.reduce((s, p) => s + p.amount, 0);

console.log(`Total FeePayments: ${allFps.length}  Active: ${activeFps.length}  Cancelled: ${cancelledFps.length}  Refunded: ${refundedFps.length}`);
console.log(`Active amount: PKR ${totalActiveAmount.toFixed(2)}`);
console.log(`Cancelled amount: PKR ${totalCancelledAmount.toFixed(2)}`);

// Check: active payments without fee link
const unlinkedPayments = activeFps.filter(p => !p.fee);
if (unlinkedPayments.length) issues.push(`⚠️  ${unlinkedPayments.length} active FeePayments have no fee link`);

// Check: active payments without voucher link
const noVoucherPayments = activeFps.filter(p => !p.voucher);
if (noVoucherPayments.length) issues.push(`⚠️  ${noVoucherPayments.length} active FeePayments have no voucher link`);

if (issues.length) issues.forEach(i => console.log(i));
else console.log('✅  All FeePayments are linked correctly\n');
issues = [];

// ──────────────────────────────────────────────────────────────
// 3. FEEVOUCHER INTEGRITY
// ──────────────────────────────────────────────────────────────
console.log('\n3. FEEVOUCHER INTEGRITY\n' + sep);

let voucherIssues = 0;
for (const v of fvs) {
  const fpPaid = feePaymentByVoucher[v._id.toString()] || 0;
  const vPaid  = v.paidAmount || 0;

  if (Math.abs(fpPaid - vPaid) > 0.01 && v.status !== 'cancelled') {
    issues.push(`⚠️  Voucher ${v.voucherNumber}: paidAmount=${vPaid} but FeePayment total=${fpPaid.toFixed(2)}`);
    voucherIssues++;
  }

  // Check totalFee = sum of netFee in enrollments
  const enrollmentTotal = (v.enrollments || []).reduce((s, e) => s + (e.netFee || 0), 0);
  const withAdmission = enrollmentTotal + (v.admissionFee || 0);
  if (Math.abs(withAdmission - v.totalFee) > 0.01) {
    issues.push(`❌ Voucher ${v.voucherNumber}: totalFee=${v.totalFee} but sum(netFee)+admissionFee=${withAdmission.toFixed(2)}`);
  }

  // Check totalWithLateFee
  const expectedWithLate = v.totalFee + (v.lateFeeAmount || 0);
  if (Math.abs(expectedWithLate - v.totalWithLateFee) > 0.01) {
    issues.push(`❌ Voucher ${v.voucherNumber}: totalWithLateFee=${v.totalWithLateFee} but totalFee+lateFeeAmount=${expectedWithLate.toFixed(2)}`);
  }
}

const paidVouchers    = fvs.filter(v => v.status === 'paid').length;
const pendingVouchers = fvs.filter(v => v.status === 'pending').length;
const overdueVouchers = fvs.filter(v => v.status === 'overdue').length;
const partialVouchers = fvs.filter(v => v.status === 'partial').length;

console.log(`Vouchers: ${fvs.length}  paid=${paidVouchers}  pending=${pendingVouchers}  overdue=${overdueVouchers}  partial=${partialVouchers}`);
console.log(`Vouchers with paidAmount mismatch: ${voucherIssues}`);

if (issues.length) issues.forEach(i => console.log(i));
else console.log('✅  All vouchers balance correctly\n');
issues = [];

// ──────────────────────────────────────────────────────────────
// 4. LEDGER INTEGRITY
// ──────────────────────────────────────────────────────────────
console.log('\n4. LEDGER INTEGRITY\n' + sep);

const ledgerAgg = await Ledger.aggregate([
  { $group: { _id: '$accountName', credit: { $sum: '$credit' }, debit: { $sum: '$debit' } } },
  { $sort: { _id: 1 } }
]).toArray();

for (const acct of ledgerAgg) {
  const net = acct.credit - acct.debit;
  console.log(`  ${acct._id.padEnd(30)} Cr=${acct.credit.toFixed(2).padStart(10)}  Dr=${acct.debit.toFixed(2).padStart(10)}  Net=${net.toFixed(2).padStart(10)}`);
}

// Fee Revenue vs Invoiced
const feeRevEntry = ledgerAgg.find(a => a._id === 'Fee Revenue');
const feeRevNet   = feeRevEntry ? feeRevEntry.credit - feeRevEntry.debit : 0;
console.log(`\n  Fee Revenue (Ledger): PKR ${feeRevNet.toFixed(2)}`);
console.log(`  Fee Invoiced (Fee model): PKR ${totalInvoiced.toFixed(2)}`);
console.log(`  Diff: PKR ${Math.abs(feeRevNet - totalInvoiced).toFixed(2)} ${Math.abs(feeRevNet - totalInvoiced) < 0.01 ? '✅' : '⚠️  MISMATCH'}`);

// AR vs Outstanding
const arEntry = ledgerAgg.find(a => a._id === 'Accounts Receivable');
const arNet   = arEntry ? arEntry.debit - arEntry.credit : 0;
console.log(`\n  AR (Ledger): PKR ${arNet.toFixed(2)}`);
console.log(`  Outstanding (Fee.balanceDue): PKR ${totalBalance.toFixed(2)}`);
console.log(`  Diff: PKR ${Math.abs(arNet - totalBalance).toFixed(2)} ${Math.abs(arNet - totalBalance) < 0.01 ? '✅' : '⚠️  MISMATCH'}`);

// Double-entry balance check
const totalCredits = ledgerAgg.reduce((s, a) => s + a.credit, 0);
const totalDebits  = ledgerAgg.reduce((s, a) => s + a.debit, 0);
console.log(`\n  Total Credits: PKR ${totalCredits.toFixed(2)}`);
console.log(`  Total Debits:  PKR ${totalDebits.toFixed(2)}`);
console.log(`  Balance Check: ${Math.abs(totalCredits - totalDebits) < 0.01 ? '✅  BALANCED' : `❌  OUT OF BALANCE BY ${Math.abs(totalCredits - totalDebits).toFixed(2)}`}`);

// ──────────────────────────────────────────────────────────────
// 5. CROSS-SYSTEM RECONCILIATION
// ──────────────────────────────────────────────────────────────
console.log('\n\n5. CROSS-SYSTEM RECONCILIATION\n' + sep);

console.log(`  Total Fee Invoiced:  PKR ${totalInvoiced.toFixed(2)}`);
console.log(`  Total Fee Collected: PKR ${totalActiveAmount.toFixed(2)} (from FeePayment)`);
console.log(`  Total Outstanding:   PKR ${totalBalance.toFixed(2)} (from Fee.balanceDue)`);
console.log(`  Collected + Balance: PKR ${(totalActiveAmount + totalBalance).toFixed(2)}`);

const reconDiff = Math.abs(totalInvoiced - totalActiveAmount - totalBalance);
console.log(`\n  RECONCILIATION: Invoiced = Collected + Balance?`);
console.log(`  Diff: PKR ${reconDiff.toFixed(2)} ${reconDiff < 0.01 ? '✅  RECONCILES' : '❌  DOES NOT RECONCILE'}`);

// ──────────────────────────────────────────────────────────────
// 6. PAYMENT SYSTEM SPLIT ANALYSIS
// ──────────────────────────────────────────────────────────────
console.log('\n\n6. PAYMENT SYSTEM ANALYSIS\n' + sep);

const feesWithEmbedded = fees.filter(f => (f.payments || []).length > 0);
const feesWithFPLink   = fees.filter(f => feePaymentByFee[f._id.toString()]);

console.log(`  Fees with embedded payments (fee.payments[]):  ${feesWithEmbedded.length}`);
console.log(`  Fees with FeePayment collection records:       ${feesWithFPLink.length}`);
if (feesWithEmbedded.length > 0) {
  console.log(`  ❌ DUAL SYSTEM CONFLICT: ${feesWithEmbedded.length} fees still use embedded payments`);
  const embTotal = feesWithEmbedded.reduce((s,f) => s + f.payments.reduce((ps,p) => ps + (p.amount||0), 0), 0);
  console.log(`     Embedded payment total: PKR ${embTotal.toFixed(2)}`);
} else {
  console.log(`  ✅  Single source of truth: FeePayment collection`);
}

// ──────────────────────────────────────────────────────────────
// 7. JOURNAL ENTRY ANALYSIS
// ──────────────────────────────────────────────────────────────
console.log('\n\n7. JOURNAL ENTRIES BY TYPE\n' + sep);

const byRefType = await Ledger.aggregate([
  { $group: { _id: '$referenceType', count: { $sum: 1 }, credit: { $sum: '$credit' }, debit: { $sum: '$debit' } } },
  { $sort: { count: -1 } }
]).toArray();

for (const r of byRefType) {
  const net = r.credit - r.debit;
  console.log(`  ${(r._id || 'null').padEnd(20)} count=${String(r.count).padStart(4)}  Cr=${r.credit.toFixed(2).padStart(10)}  Dr=${r.debit.toFixed(2).padStart(10)}  Net=${net.toFixed(2).padStart(10)}`);
}

console.log(`\n${SEP}`);
console.log('  AUDIT COMPLETE');
console.log(`${SEP}\n`);

await mongoose.disconnect();
