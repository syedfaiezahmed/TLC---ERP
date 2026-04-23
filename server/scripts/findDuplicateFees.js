/**
 * Find duplicate Fee records and check Nabeeha Ahmed specifically
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
const FeeVoucher = db.collection('feevouchers');
const FeePayment = db.collection('feepayments');
const Student    = db.collection('students');

// Find Nabeeha Ahmed
const nabeeha = await Student.findOne({ name: /nabeeha/i });
if (!nabeeha) { console.log('Student Nabeeha not found'); process.exit(0); }
console.log(`Student: ${nabeeha.name} | ID: ${nabeeha._id}\n`);

// Show all fees for Nabeeha
const fees = await Fee.find({ student: nabeeha._id }).sort({ date: 1 }).toArray();
console.log(`Total Fee records for Nabeeha: ${fees.length}`);
for (const f of fees) {
  console.log(`  Fee #${f.feeNumber} | status: ${f.status} | total: ${f.totalAmount} | due: ${f.dueDate?.toISOString?.().slice(0,10)} | balanceDue: ${f.balanceDue}`);
  for (const item of (f.items || [])) {
    console.log(`    - ${item.description}: ${item.amount}`);
  }
}

// Show all vouchers for Nabeeha
const vouchers = await FeeVoucher.find({ student: nabeeha._id }).sort({ generatedDate: 1 }).toArray();
console.log(`\nTotal Voucher records for Nabeeha: ${vouchers.length}`);
for (const v of vouchers) {
  console.log(`  Voucher ${v.voucherNumber} | status: ${v.status} | total: ${v.totalFee} | month: ${v.month?.toISOString?.().slice(0,7)} | fee: ${v.fee}`);
}

// Show all payments for Nabeeha
const payments = await FeePayment.find({ student: nabeeha._id }).sort({ paymentDate: 1 }).toArray();
console.log(`\nTotal Payment records for Nabeeha: ${payments.length}`);
for (const p of payments) {
  console.log(`  Payment ${p.paymentNumber} | status: ${p.status} | amount: ${p.amount} | date: ${p.paymentDate?.toISOString?.().slice(0,10)} | fee: ${p.fee} | voucher: ${p.voucher}`);
}

// Check for duplicate fees system-wide
console.log('\n══════════════════════════════════════════════');
console.log('SYSTEM-WIDE DUPLICATE FEE CHECK');
console.log('══════════════════════════════════════════════');
const dupFees = await Fee.aggregate([
  { $match: { status: { $ne: 'cancelled' } } },
  {
    $group: {
      _id: {
        student: '$student',
        monthYear: { $dateToString: { format: '%Y-%m', date: '$dueDate' } }
      },
      feeIds: { $push: '$_id' },
      feeNumbers: { $push: '$feeNumber' },
      count: { $sum: 1 }
    }
  },
  { $match: { count: { $gt: 1 } } }
]).toArray();

if (dupFees.length === 0) {
  console.log('✅  No duplicate Fee records found.');
} else {
  console.log(`⚠️  Found ${dupFees.length} student-month group(s) with duplicate Fee records:`);
  for (const d of dupFees) {
    const student = await Student.findOne({ _id: d._id.student });
    console.log(`  Student: ${student?.name || d._id.student} | Month: ${d._id.monthYear} | Fee#s: ${d.feeNumbers.join(', ')}`);
  }
}

await mongoose.disconnect();
