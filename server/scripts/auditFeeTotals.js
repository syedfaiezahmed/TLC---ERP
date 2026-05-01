import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Fee from '../src/models/Fee.js';
import FeePayment from '../src/models/FeePayment.js';
import FeeVoucher from '../src/models/FeeVoucher.js';
import Ledger from '../src/models/Ledger.js';

dotenv.config();

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));

const sum = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

const main = async () => {
  const company = args.company;
  const start = args.start ? new Date(args.start) : new Date('1970-01-01');
  const end = args.end ? new Date(args.end) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (!company) throw new Error('Usage: node scripts/auditFeeTotals.js --company=<companyId> --start=YYYY-MM-DD --end=YYYY-MM-DD');
  await mongoose.connect(process.env.MONGO_URI);
  const companyObj = new mongoose.Types.ObjectId(company);

  const feePayments = await FeePayment.find({ company: companyObj, status: 'active', paymentDate: { $gte: start, $lte: end } }).lean();
  const vouchers = await FeeVoucher.find({ company: companyObj, status: { $ne: 'cancelled' } }).lean();
  const vouchersInPaymentPeriod = vouchers.filter(v => v.paidDate && new Date(v.paidDate) >= start && new Date(v.paidDate) <= end);
  const fees = await Fee.find({ company: companyObj }).lean();
  const feeEmbeddedPayments = [];
  fees.forEach(fee => {
    (fee.payments || []).forEach(payment => {
      const date = new Date(payment.date);
      if (date >= start && date <= end) feeEmbeddedPayments.push({ fee: fee._id, ...payment });
    });
  });
  const ledgerCashBank = await Ledger.find({ company: companyObj, accountName: { $in: ['Cash', 'Bank'] }, date: { $gte: start, $lte: end } }).lean();
  const ledgerARCredits = await Ledger.find({ company: companyObj, accountName: 'Accounts Receivable', date: { $gte: start, $lte: end } }).lean();
  const ledgerFeePaymentRefs = await Ledger.find({ company: companyObj, referenceType: { $in: ['fee_payment', 'fee_collection', 'payment'] }, date: { $gte: start, $lte: end } }).lean();

  const byDate = new Map();
  feePayments.forEach(payment => {
    const key = payment.paymentDate.toISOString().slice(0, 10);
    const row = byDate.get(key) || { date: key, count: 0, received: 0, discount: 0, lateFee: 0 };
    row.count += 1;
    row.received += payment.amount || 0;
    row.discount += payment.discountAmount || 0;
    row.lateFee += payment.lateFeeAmount || 0;
    byDate.set(key, row);
  });

  const linkedFeeIds = new Set(feePayments.map(p => p.fee?.toString()).filter(Boolean));
  const duplicateEmbedded = feeEmbeddedPayments.filter(payment => linkedFeeIds.has(payment.fee?.toString()));

  console.log('FEE TOTALS AUDIT');
  console.log({ company, start: start.toISOString(), end: end.toISOString() });
  console.log('\nCANONICAL SOURCE: FeePayment active records');
  console.table({
    feePaymentCount: feePayments.length,
    feePaymentReceived: sum(feePayments, 'amount'),
    feePaymentDiscount: sum(feePayments, 'discountAmount'),
    feePaymentLateFee: sum(feePayments, 'lateFeeAmount'),
    feePaymentNetBaseReceived: sum(feePayments, 'amount') - sum(feePayments, 'lateFeeAmount'),
  });
  console.log('\nOTHER SOURCES FOR COMPARISON');
  console.table({
    voucherPaidByPaidDate: sum(vouchersInPaymentPeriod, 'paidAmount'),
    allVoucherPaidCache: sum(vouchers, 'paidAmount'),
    embeddedFeePayments: sum(feeEmbeddedPayments, 'amount'),
    duplicateEmbeddedLinkedToFeePayment: duplicateEmbedded.reduce((t, p) => t + (Number(p.amount) || 0), 0),
    ledgerCashBankDebit: ledgerCashBank.reduce((t, l) => t + (Number(l.debit) || 0), 0),
    ledgerARCredit: ledgerARCredits.reduce((t, l) => t + (Number(l.credit) || 0), 0),
    ledgerPaymentRefRows: ledgerFeePaymentRefs.length,
  });
  console.log('\nBY DATE (FeePayment active)');
  console.table([...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)));

  await mongoose.disconnect();
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
