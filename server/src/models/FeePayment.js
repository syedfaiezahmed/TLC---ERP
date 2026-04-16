import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const feePaymentSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Student',
    },
    fee: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: 'Fee',
    },
    voucher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeVoucher',
    },
    paymentNumber: {
      type: String,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'UPI', 'Credit Card'],
      required: true,
    },
    referenceNumber: {
      type: String,
    },
    bankName: {
      type: String,
    },
    chequeNumber: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    lateFeeApplied: {
      type: Boolean,
      default: false,
    },
    lateFeeAmount: {
      type: Number,
      default: 0,
    },
    discountApplied: {
      type: Boolean,
      default: false,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    discountReason: {
      type: String,
    },
    discountApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'refunded'],
      default: 'active',
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    refundDate: {
      type: Date,
    },
    refundReason: {
      type: String,
    },
    academicYear: {
      type: String,
    },
    month: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Generate payment number before saving — always sets a value, never throws
feePaymentSchema.pre('save', async function () {
  if (!this.paymentNumber) {
    try {
      const currentYear = new Date().getUTCFullYear();
      const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
      const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
      const count = await this.constructor.countDocuments({
        company: this.company,
        paymentDate: { $gte: startOfYear, $lte: endOfYear },
      });
      this.paymentNumber = `PAY-${currentYear}-${String(count + 1).padStart(6, '0')}`;
    } catch (err) {
      // Fallback to timestamp-based unique number — never leave paymentNumber empty
      this.paymentNumber = `PAY-${new Date().getUTCFullYear()}-${Date.now()}`;
    }
  }
});

// Post-save hooks MUST be before mongoose.model() to fire correctly
feePaymentSchema.post('save', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feePaymentSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feePaymentSchema.post('findOneAndDelete', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});

// Indexes for performance
feePaymentSchema.index({ company: 1, paymentNumber: 1 }, { unique: true });
feePaymentSchema.index({ company: 1, student: 1 });
feePaymentSchema.index({ company: 1, fee: 1 });
feePaymentSchema.index({ company: 1, paymentDate: 1 });
feePaymentSchema.index({ company: 1, status: 1 });
feePaymentSchema.index({ company: 1, receivedBy: 1 });
// Optimizes the voucher-heal aggregation (SUM amount per voucher WHERE status='active')
feePaymentSchema.index({ company: 1, status: 1, voucher: 1 });

const FeePayment = mongoose.model('FeePayment', feePaymentSchema);

export default FeePayment;
