import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const feeVoucherSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    voucherNumber: {
      type: String,
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Student',
    },
    month: {
      type: Date,
      required: true,
    },
    enrollments: [
      {
        enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentEnrollment' },
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        courseName: { type: String, required: true },
        monthlyFee: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        netFee: { type: Number, required: true },
      },
    ],
    totalFee: {
      type: Number,
      required: true,
    },
    totalOriginalFee: {
      type: Number,
      default: 0,
      description: 'Sum of all enrollment monthlyFees BEFORE discount (gross)',
    },
    totalDiscount: {
      type: Number,
      default: 0,
      description: 'Sum of all enrollment discounts applied',
    },
    baseFee: {
      type: Number,
      description: 'Total without admission fee',
    },
    admissionFee: {
      type: Number,
      default: 0,
      description: 'One-time admission fee included in this voucher',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    lateFeeAmount: {
      type: Number,
      default: 200,
    },
    totalWithLateFee: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'cancelled', 'overdue'],
      default: 'pending',
    },
    paidDate: {
      type: Date,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
    },
    paymentReference: {
      type: String,
    },
    fee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fee',
    },
    notes: {
      type: String,
    },
    generatedDate: {
      type: Date,
      default: Date.now,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Calculate totals before saving
feeVoucherSchema.pre('save', function () {
  this.totalWithLateFee = this.totalFee + (this.lateFeeAmount || 0);
  // Roll up line-item discount data to voucher-level for quick display.
  if (Array.isArray(this.enrollments) && this.enrollments.length) {
    this.totalOriginalFee = this.enrollments.reduce((s, e) => s + (e.monthlyFee || 0), 0)
      + (this.admissionFee || 0);
    this.totalDiscount = this.enrollments.reduce((s, e) => s + (e.discount || 0), 0);
  }
});

// Method to check if voucher is overdue
feeVoucherSchema.methods.isOverdue = function () {
  if (this.status === 'paid' || this.status === 'cancelled') {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(this.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  return today > dueDate;
};

// Method to get applicable amount (with or without late fee)
feeVoucherSchema.methods.getApplicableAmount = function () {
  return this.isOverdue() ? this.totalWithLateFee : this.totalFee;
};

// Indexes
feeVoucherSchema.index({ company: 1, voucherNumber: 1 }, { unique: true });
feeVoucherSchema.index({ company: 1, student: 1, month: 1 });
feeVoucherSchema.index({ company: 1, status: 1 });
feeVoucherSchema.index({ dueDate: 1, status: 1 });

feeVoucherSchema.post('save', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeVoucherSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeVoucherSchema.post('findOneAndDelete', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});

const FeeVoucher = mongoose.model('FeeVoucher', feeVoucherSchema);

export default FeeVoucher;
