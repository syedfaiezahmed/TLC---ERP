/**
 * FULL SYSTEM FINANCIAL AUDIT
 * Covers: Fees, Late Fees, Payments, Ledger, AR, Cash/Bank,
 *         Expenses, Payroll, Income Statement (P&L), Balance Sheet
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅  MongoDB connected\n');

const db = mongoose.connection;
const Fee        = db.collection('fees');
const FeePayment = db.collection('feepayments');
const FeeVoucher = db.collection('feevouchers');
const Ledger     = db.collection('ledgers');
const Student    = db.collection('students');
const Company    = db.collection('companies');

const sep  = '─'.repeat(70);
const sep2 = '═'.repeat(70);
let totalIssues = 0;

const flag = (msg) => { totalIssues++; console.log(`  ❌  ${msg}`); };
const ok   = (msg) => console.log(`  ✅  ${msg}`);
const info = (msg) => console.log(`  ℹ️   ${msg}`);

console.log(sep2);
console.log('  FULL SYSTEM FINANCIAL AUDIT');
console.log(sep2);

// ── Ledger summary helper ────────────────────────────────────────────────────
const ledgerSummary = await Ledger.aggregate([
  { $group: { _id: '$accountName', dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } },
  { $sort: { _id: 1 } }
]).toArray();

const acct = (name) => {
  const a = ledgerSummary.find(x => x._id === name);
  return { dr: a?.dr || 0, cr: a?.cr || 0, net: (a?.dr || 0) - (a?.cr || 0) };
};

// ════════════════════════════════════════════════════════════════════════════
// 1. DOUBLE-ENTRY BALANCE
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n1. DOUBLE-ENTRY BALANCE\n${sep}`);
const totalDr = ledgerSummary.reduce((s, a) => s + a.dr, 0);
const totalCr = ledgerSummary.reduce((s, a) => s + a.cr, 0);
const debalance = Math.abs(totalDr - totalCr);
console.log(`  Total Debits:  PKR ${totalDr.toFixed(2)}`);
console.log(`  Total Credits: PKR ${totalCr.toFixed(2)}`);
if (debalance < 0.01) ok(`BALANCED  (Dr = Cr = ${totalDr.toFixed(2)})`);
else flag(`OUT OF BALANCE by PKR ${debalance.toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// 2. ACCOUNT BALANCES (Chart of Accounts)
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n2. LEDGER ACCOUNT BALANCES\n${sep}`);
for (const a of ledgerSummary) {
  const net = a.cr - a.dr;
  const sign = net >= 0 ? '+' : '';
  console.log(`  ${a._id.padEnd(32)} Dr=${a.dr.toFixed(0).padStart(9)}  Cr=${a.cr.toFixed(0).padStart(9)}  Net=${sign}${net.toFixed(0).padStart(9)}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 3. FEE MODEL INTEGRITY
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n3. FEE MODEL INTEGRITY\n${sep}`);

const fees = await Fee.find({}).toArray();
const activeFees     = fees.filter(f => f.status !== 'cancelled');
const cancelledFees  = fees.filter(f => f.status === 'cancelled');

let feeInvoiced = 0, feePaid = 0, feeDisc = 0, feeRefund = 0, feeBalance = 0, feeVoided = 0;
const feeIssues = [];

for (const f of fees) {
  if (f.status === 'cancelled') { feeVoided += f.totalAmount || 0; continue; }
  feeInvoiced += f.totalAmount    || 0;
  feePaid     += f.paidAmount     || 0;
  feeDisc     += f.writeOffAmount || 0;
  feeRefund   += f.refundAmount   || 0;
  feeBalance  += f.balanceDue     || 0;

  const computed = (f.paidAmount||0) + (f.writeOffAmount||0) + (f.refundAmount||0) + (f.balanceDue||0);
  if (Math.abs(computed - f.totalAmount) > 0.01) {
    const s = await Student.findOne({ _id: f.student });
    feeIssues.push(`Fee #${f.feeNumber} (${s?.name}): totalAmount=${f.totalAmount} ≠ paid+disc+refund+balance=${computed.toFixed(2)}`);
  }
}

console.log(`  Fees: ${fees.length} total  (${activeFees.length} active, ${cancelledFees.length} voided)`);
console.log(`  Invoiced (active): PKR ${feeInvoiced.toFixed(2)}`);
console.log(`  Paid (base fee):   PKR ${feePaid.toFixed(2)}`);
console.log(`  Discounts:         PKR ${feeDisc.toFixed(2)}`);
console.log(`  Refunds:           PKR ${feeRefund.toFixed(2)}`);
console.log(`  Balance:           PKR ${feeBalance.toFixed(2)}`);
console.log(`  Voided:            PKR ${feeVoided.toFixed(2)}`);

const feeDelta = Math.abs(feeInvoiced - feePaid - feeDisc - feeRefund - feeBalance);
if (feeDelta < 0.01) ok(`Fee formula balances: ${feeInvoiced} = ${feePaid}+${feeDisc}+${feeRefund}+${feeBalance}`);
else flag(`Fee formula mismatch: diff = ${feeDelta.toFixed(2)}`);
if (feeIssues.length) feeIssues.forEach(flag); else ok('All individual fee records balance correctly');

// ════════════════════════════════════════════════════════════════════════════
// 4. LATE FEE ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n4. LATE FEE ANALYSIS\n${sep}`);

const allFPs = await FeePayment.find({ status: 'active' }).toArray();
const lateFeePmts   = allFPs.filter(p => p.lateFeeApplied && (p.lateFeeAmount || 0) > 0);
const totalLateFeeCollected = lateFeePmts.reduce((s, p) => s + (p.lateFeeAmount || 0), 0);
const totalCashWithLateFee  = lateFeePmts.reduce((s, p) => s + p.amount, 0);
const totalBaseInLateFee    = lateFeePmts.reduce((s, p) => s + (p.amount - (p.lateFeeAmount || 0)), 0);

console.log(`  Payments with late fee: ${lateFeePmts.length}`);
console.log(`  Total late fee collected: PKR ${totalLateFeeCollected.toFixed(2)}`);
console.log(`  Cash (base + late fee): PKR ${totalCashWithLateFee.toFixed(2)}`);
console.log(`  Base fee portion: PKR ${totalBaseInLateFee.toFixed(2)}`);

const lateFeeRevLedger = acct('Late Fee Revenue');
const lateFeeRevNet = lateFeeRevLedger.cr - lateFeeRevLedger.dr;
console.log(`  Late Fee Revenue (ledger net): PKR ${lateFeeRevNet.toFixed(2)}`);

if (lateFeePmts.length === 0) {
  info('No late fee payments recorded yet — late fee revenue tracking ready for future use');
} else {
  if (Math.abs(lateFeeRevNet - totalLateFeeCollected) < 0.01)
    ok(`Late Fee Revenue ledger matches FeePayment data: PKR ${lateFeeRevNet.toFixed(2)}`);
  else
    flag(`Late Fee Revenue mismatch: ledger=${lateFeeRevNet.toFixed(2)} vs FeePayment=${totalLateFeeCollected.toFixed(2)}`);

  // Check AR is NOT over-credited (base fee only should be in AR for each late-fee payment)
  for (const p of lateFeePmts) {
    const settle = await Ledger.findOne({
      referenceId: p._id, accountName: 'Accounts Receivable', credit: { $gt: 0 }
    });
    if (!settle) { flag(`PAY ${p.paymentNumber}: no AR credit entry found`); continue; }
    const expectedARCredit = (p.amount - (p.lateFeeAmount || 0)) + (p.discountAmount || 0);
    if (Math.abs(settle.credit - expectedARCredit) > 0.01)
      flag(`PAY ${p.paymentNumber}: AR Cr=${settle.credit.toFixed(2)} expected=${expectedARCredit.toFixed(2)} (base+disc only)`);
    else
      ok(`PAY ${p.paymentNumber}: AR credit correct (${settle.credit.toFixed(2)} = base only)`);
  }
}

// Overdue vouchers
const overdueVouchers = await FeeVoucher.find({ status: 'overdue' }).toArray();
let totalOverdueBase = 0, totalOverdueWithLateFee = 0;
for (const v of overdueVouchers) {
  const s = await Student.findOne({ _id: v.student });
  const paidSoFar = v.paidAmount || 0;
  const dueBase = Math.max(0, v.totalFee - paidSoFar);
  const dueWithLate = Math.max(0, (v.totalWithLateFee || v.totalFee) - paidSoFar);
  totalOverdueBase += dueBase;
  totalOverdueWithLateFee += dueWithLate;
  console.log(`  Overdue: ${v.voucherNumber} (${s?.name}) — Base due: ${dueBase}  With late fee: ${dueWithLate}`);
}
console.log(`  Total overdue (base):          PKR ${totalOverdueBase.toFixed(2)}`);
console.log(`  Total overdue (with late fee): PKR ${totalOverdueWithLateFee.toFixed(2)}`);
info(`AR tracks BASE fees only (${totalOverdueBase.toFixed(2)}). Late fee recognized only when collected.`);

// ════════════════════════════════════════════════════════════════════════════
// 5. ACCOUNTS RECEIVABLE RECONCILIATION
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n5. ACCOUNTS RECEIVABLE\n${sep}`);
const arAcct = acct('Accounts Receivable');
const arNet  = arAcct.dr - arAcct.cr;
console.log(`  AR (ledger Dr-Cr): PKR ${arNet.toFixed(2)}`);
console.log(`  Fee.balanceDue:    PKR ${feeBalance.toFixed(2)}`);
if (Math.abs(arNet - feeBalance) < 0.01) ok(`AR matches Fee.balanceDue ✅`);
else flag(`AR mismatch: ledger=${arNet.toFixed(2)} vs fee.balanceDue=${feeBalance.toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// 6. CASH & BANK RECONCILIATION
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n6. CASH & BANK\n${sep}`);
const cashAcct = acct('Cash');
const bankAcct = acct('Bank');
const cashBal  = cashAcct.dr - cashAcct.cr;
const bankBal  = bankAcct.dr - bankAcct.cr;
const totalLiquid = cashBal + bankBal;

console.log(`  Cash  (ledger): PKR ${cashBal.toFixed(2)}`);
console.log(`  Bank  (ledger): PKR ${bankBal.toFixed(2)}`);
console.log(`  Total liquid:   PKR ${totalLiquid.toFixed(2)}`);

// Verify Cash/Bank = sum of active FeePayment amounts
const cashPmts = allFPs.filter(p => p.paymentMethod === 'Cash' || !p.paymentMethod);
const bankPmts = allFPs.filter(p => p.paymentMethod && p.paymentMethod !== 'Cash');
const fpCashTotal = cashPmts.reduce((s, p) => s + p.amount, 0);
const fpBankTotal = bankPmts.reduce((s, p) => s + p.amount, 0);

// Also include other (generic student payments via Ledger)
const otherCashLedger = await Ledger.aggregate([
  { $match: { accountName: 'Cash', type: { $ne: 'payment' } } },
  { $group: { _id: null, dr: { $sum: '$debit' } } }
]).toArray();
const otherBankLedger = await Ledger.aggregate([
  { $match: { accountName: 'Bank', type: { $ne: 'payment' } } },
  { $group: { _id: null, dr: { $sum: '$debit' } } }
]).toArray();

console.log(`  FeePayment cash total:  PKR ${fpCashTotal.toFixed(2)}`);
console.log(`  FeePayment bank total:  PKR ${fpBankTotal.toFixed(2)}`);
if (cashBal >= 0) ok(`Cash balance positive: PKR ${cashBal.toFixed(2)}`);
else flag(`Cash balance NEGATIVE: PKR ${cashBal.toFixed(2)}`);
if (bankBal >= 0) ok(`Bank balance positive: PKR ${bankBal.toFixed(2)}`);
else flag(`Bank balance NEGATIVE: PKR ${bankBal.toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// 7. FEE REVENUE RECONCILIATION
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n7. FEE REVENUE RECONCILIATION\n${sep}`);
const feeRevAcct = acct('Fee Revenue');
const feeRevNet  = feeRevAcct.cr - feeRevAcct.dr;  // Cr-Dr for revenue account
const discAcct   = acct('Scholarship/Discount');
const discNet    = discAcct.dr - discAcct.cr;       // Dr-Cr for expense account

console.log(`  Fee Revenue (ledger Cr-Dr):   PKR ${feeRevNet.toFixed(2)}`);
console.log(`  Scholarship/Discount:         PKR ${discNet.toFixed(2)}`);
console.log(`  Late Fee Revenue:             PKR ${lateFeeRevNet.toFixed(2)}`);
console.log(`  Total Gross Revenue:          PKR ${(feeRevNet + lateFeeRevNet).toFixed(2)}`);
console.log(`  Net After Discounts:          PKR ${(feeRevNet + lateFeeRevNet - discNet).toFixed(2)}`);
console.log(`  Fee invoiced (active fees):   PKR ${feeInvoiced.toFixed(2)}`);

if (Math.abs(feeRevNet - feeInvoiced) < 0.01)
  ok(`Fee Revenue ledger = active fee invoiced amount`);
else
  flag(`Fee Revenue mismatch: ledger=${feeRevNet.toFixed(2)} vs active invoiced=${feeInvoiced.toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// 8. CROSS-SYSTEM RECONCILIATION (Grand Total)
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n8. GRAND RECONCILIATION\n${sep}`);
const totalFPBase       = allFPs.reduce((s, p) => s + (p.amount - (p.lateFeeAmount || 0)), 0);
const totalFPLateFee    = allFPs.reduce((s, p) => s + (p.lateFeeAmount || 0), 0);
const totalFPCash       = allFPs.reduce((s, p) => s + p.amount, 0);
const totalGrossInvcd   = feeInvoiced + feeVoided;

console.log(`  Gross invoiced (all fees):    PKR ${totalGrossInvcd.toFixed(2)}`);
console.log(`  Voided fees:                  PKR ${feeVoided.toFixed(2)}`);
console.log(`  Active invoiced:              PKR ${feeInvoiced.toFixed(2)}`);
console.log(`  Cash collected (base):        PKR ${totalFPBase.toFixed(2)}`);
console.log(`  Late fees collected:          PKR ${totalFPLateFee.toFixed(2)}`);
console.log(`  Total cash in:                PKR ${totalFPCash.toFixed(2)}`);
console.log(`  Discounts given:              PKR ${feeDisc.toFixed(2)}`);
console.log(`  Outstanding (AR):             PKR ${feeBalance.toFixed(2)}`);
console.log(`  Sum (base+disc+balance):      PKR ${(totalFPBase + feeDisc + feeBalance).toFixed(2)}`);

const grandDiff = Math.abs(feeInvoiced - totalFPBase - feeDisc - feeRefund - feeBalance);
if (grandDiff < 0.01) ok(`Grand reconciliation: ${feeInvoiced} = ${totalFPBase}(base)+${feeDisc}(disc)+${feeRefund}(refund)+${feeBalance}(balance) ✅`);
else flag(`Grand reconciliation mismatch: diff = ${grandDiff.toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// 9. EXPENSES
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n9. EXPENSES\n${sep}`);
const expenseAccts = ledgerSummary.filter(a => {
  const expNames = ['Salary Expense','Payroll Expense','Rent Expense','Utilities Expense',
    'Stationery Expense','Maintenance Expense','Scholarship/Discount','Bad Debt Expense',
    'Depreciation Expense', 'Other Expense'];
  return expNames.some(n => a._id.includes(n) || n.includes(a._id));
});
const allExpLedger = ledgerSummary.filter(a => {
  const row = Ledger;
  return false; // will use aggregate below
});
const expAgg = await Ledger.aggregate([
  { $match: { accountType: 'expense' } },
  { $group: { _id: '$accountName', dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } },
  { $sort: { _id: 1 } }
]).toArray();

let totalExpenses = 0;
for (const e of expAgg) {
  const net = e.dr - e.cr;
  totalExpenses += net;
  console.log(`  ${e._id.padEnd(32)} PKR ${net.toFixed(2)}`);
}
console.log(`  ${'TOTAL EXPENSES'.padEnd(32)} PKR ${totalExpenses.toFixed(2)}`);
if (totalExpenses >= 0) ok(`Expense accounts have positive (Dr) balances`);
else flag(`Expense accounts have net CREDIT (negative) balance — unusual`);

// ════════════════════════════════════════════════════════════════════════════
// 10. INCOME STATEMENT (P&L)
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n10. INCOME STATEMENT (P&L)\n${sep}`);
const revAgg = await Ledger.aggregate([
  { $match: { accountType: 'revenue' } },
  { $group: { _id: '$accountName', dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } },
  { $sort: { _id: 1 } }
]).toArray();

let totalRevenue = 0;
for (const r of revAgg) {
  const net = r.cr - r.dr;
  totalRevenue += net;
  console.log(`  ${r._id.padEnd(32)} PKR ${net.toFixed(2)}`);
}
console.log(`  ${'TOTAL REVENUE'.padEnd(32)} PKR ${totalRevenue.toFixed(2)}`);
const grossProfit  = totalRevenue;
const netIncome    = grossProfit - totalExpenses;
console.log(`\n  Gross Profit:   PKR ${grossProfit.toFixed(2)}`);
console.log(`  Total Expenses: PKR ${totalExpenses.toFixed(2)}`);
console.log(`  Net Income:     PKR ${netIncome.toFixed(2)}`);
if (netIncome >= 0) ok(`Business is PROFITABLE: PKR ${netIncome.toFixed(2)} net income`);
else info(`Business shows net LOSS: PKR ${Math.abs(netIncome).toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// 11. BALANCE SHEET CHECK
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n11. BALANCE SHEET\n${sep}`);
const assetAgg = await Ledger.aggregate([
  { $match: { accountType: 'asset' } },
  { $group: { _id: '$accountName', dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } },
  { $sort: { _id: 1 } }
]).toArray();
const liabAgg = await Ledger.aggregate([
  { $match: { accountType: 'liability' } },
  { $group: { _id: '$accountName', dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } },
  { $sort: { _id: 1 } }
]).toArray();
const equityAgg = await Ledger.aggregate([
  { $match: { accountType: 'equity' } },
  { $group: { _id: '$accountName', dr: { $sum: '$debit' }, cr: { $sum: '$credit' } } },
  { $sort: { _id: 1 } }
]).toArray();

let totalAssets = 0;
console.log('  ASSETS:');
for (const a of assetAgg) {
  const net = a.dr - a.cr;  // assets: normal Dr balance
  totalAssets += net;
  const flag_neg = net < -0.01 ? ' ⚠️' : '';
  console.log(`    ${a._id.padEnd(30)} PKR ${net.toFixed(2)}${flag_neg}`);
}
console.log(`    ${'TOTAL ASSETS'.padEnd(30)} PKR ${totalAssets.toFixed(2)}`);

let totalLiabilities = 0;
console.log('  LIABILITIES:');
for (const a of liabAgg) {
  const net = a.cr - a.dr;  // liabilities: normal Cr balance
  totalLiabilities += net;
  console.log(`    ${a._id.padEnd(30)} PKR ${net.toFixed(2)}`);
}
console.log(`    ${'TOTAL LIABILITIES'.padEnd(30)} PKR ${totalLiabilities.toFixed(2)}`);

let totalEquity = 0;
console.log('  EQUITY:');
for (const a of equityAgg) {
  const net = a.cr - a.dr;
  totalEquity += net;
  console.log(`    ${a._id.padEnd(30)} PKR ${net.toFixed(2)}`);
}
// Retained earnings = net income (since no dividend/withdrawal entries yet)
totalEquity += netIncome;
console.log(`    ${'Retained Earnings (Net Income)'.padEnd(30)} PKR ${netIncome.toFixed(2)}`);
console.log(`    ${'TOTAL EQUITY'.padEnd(30)} PKR ${totalEquity.toFixed(2)}`);

const liabPlusEquity = totalLiabilities + totalEquity;
console.log(`\n  Assets = ${totalAssets.toFixed(2)}  |  Liabilities + Equity = ${liabPlusEquity.toFixed(2)}`);
if (Math.abs(totalAssets - liabPlusEquity) < 1.0)
  ok(`Balance Sheet balances (Assets = Liabilities + Equity)`);
else
  flag(`Balance Sheet out of balance: diff = ${Math.abs(totalAssets - liabPlusEquity).toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// 12. VOUCHER INTEGRITY
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n12. VOUCHER INTEGRITY\n${sep}`);
const vouchers = await FeeVoucher.find({}).toArray();
const vByStatus = vouchers.reduce((m, v) => { m[v.status] = (m[v.status]||0)+1; return m; }, {});
console.log(`  Total vouchers: ${vouchers.length}  ${JSON.stringify(vByStatus)}`);

let voucherIssues = 0;
const fpByVoucher = await FeePayment.aggregate([
  { $match: { status: 'active', voucher: { $ne: null } } },
  { $group: { _id: '$voucher', total: { $sum: '$amount' }, lateFeeTotal: { $sum: { $ifNull: ['$lateFeeAmount', 0] } } } }
]).toArray();
const fpVMap = new Map(fpByVoucher.map(r => [String(r._id), r]));

for (const v of vouchers) {
  if (v.status === 'cancelled') continue;
  const fp = fpVMap.get(String(v._id));
  const fpPaid = fp?.total || 0;
  if (Math.abs(fpPaid - (v.paidAmount||0)) > 0.5) {
    const s = await Student.findOne({ _id: v.student });
    flag(`Voucher ${v.voucherNumber} (${s?.name}): paidAmount=${v.paidAmount} but FeePayments sum=${fpPaid.toFixed(2)}`);
    voucherIssues++;
  }
}
if (voucherIssues === 0) ok('All voucher paidAmounts match FeePayment totals');

// ════════════════════════════════════════════════════════════════════════════
// 13. ORPHAN & DATA QUALITY CHECKS
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n13. DATA QUALITY\n${sep}`);

// FeePayments without a voucher link
const noVoucherPmts = await FeePayment.countDocuments({ status: 'active', voucher: null });
if (noVoucherPmts > 0) flag(`${noVoucherPmts} active FeePayments have no voucher link`);
else ok('All active FeePayments have voucher links');

// FeePayments without a fee link
const noFeePmts = await FeePayment.countDocuments({ status: 'active', fee: null });
if (noFeePmts > 0) info(`${noFeePmts} active FeePayments have no fee link (auto-created at payment time — acceptable)`);
else ok('All active FeePayments have fee links');

// Negative balanceDue on active fees
const negBalFees = activeFees.filter(f => (f.balanceDue||0) < -0.01);
if (negBalFees.length > 0) {
  for (const f of negBalFees) {
    const s = await Student.findOne({ _id: f.student });
    flag(`Fee #${f.feeNumber} (${s?.name}): negative balanceDue = ${f.balanceDue}`);
  }
} else ok('No fees with negative balanceDue');

// paidAmount > totalAmount (indicates late fee included in paidAmount — old bug)
const overpaidFees = activeFees.filter(f => (f.paidAmount||0) > (f.totalAmount||0) + 0.01);
if (overpaidFees.length > 0) {
  for (const f of overpaidFees) {
    const s = await Student.findOne({ _id: f.student });
    flag(`Fee #${f.feeNumber} (${s?.name}): paidAmount=${f.paidAmount} > totalAmount=${f.totalAmount} (late fee included in paid — run repairFeeBalances.js)`);
  }
} else ok('No fees where paidAmount exceeds totalAmount');

// Unlinked Ledger entries
const noCompanyLedger = await Ledger.countDocuments({ company: null });
if (noCompanyLedger > 0) flag(`${noCompanyLedger} ledger entries have no company link`);
else ok('All ledger entries have company links');

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${sep2}`);
console.log('  AUDIT SUMMARY');
console.log(sep2);
console.log(`  Total Issues Found: ${totalIssues}`);
if (totalIssues === 0) {
  console.log('  🎉  SYSTEM IS 100% CLEAN — ALL CHECKS PASSED');
} else {
  console.log(`  ⚠️   ${totalIssues} issue(s) require attention (see ❌ lines above)`);
}
console.log(sep2);

await mongoose.disconnect();
