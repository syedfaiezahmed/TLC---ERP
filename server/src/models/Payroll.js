import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const payrollSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Teacher',
    },
    month: {
      type: Date,
      required: true,
    },
    salaryType: {
      type: String,
      enum: ['fixed', 'per_class', 'commission', 'hybrid'],
      required: true,
    },
    salaryComponents: {
      fixedSalary: {
        amount: { type: Number, default: 0 },
      },
      perClassEarnings: {
        classCount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        breakdown: [
          {
            course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
            courseName: { type: String },
            classCount: { type: Number, required: true },
            ratePerClass: { type: Number, required: true },
            amount: { type: Number, required: true },
          },
        ],
      },
      commission: {
        totalAmount: { type: Number, default: 0 },
        breakdown: [
          {
            course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
            courseName: { type: String },
            feeCollected: { type: Number, required: true },
            commissionRate: { type: Number, required: true }, // Percentage
            amount: { type: Number, required: true },
          },
        ],
      },
    },
    totalSalary: {
      type: Number,
      required: true,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    deductionDetails: [
      {
        description: { type: String },
        amount: { type: Number, required: true },
      },
    ],
    netSalary: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'paid', 'cancelled'],
      default: 'draft',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedDate: {
      type: Date,
    },
    paidDate: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque'],
    },
    paymentReference: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate totals before saving
payrollSchema.pre('save', function () {
  let total = 0;

  // Add fixed salary
  if (this.salaryComponents.fixedSalary) {
    total += this.salaryComponents.fixedSalary.amount || 0;
  }

  // Add per-class earnings
  if (this.salaryComponents.perClassEarnings) {
    total += this.salaryComponents.perClassEarnings.totalAmount || 0;
  }

  // Add commission
  if (this.salaryComponents.commission) {
    total += this.salaryComponents.commission.totalAmount || 0;
  }

  this.totalSalary = total;
  this.netSalary = total - (this.deductions || 0);
});

// Indexes
payrollSchema.index({ company: 1, teacher: 1, month: 1 }, { unique: true });
payrollSchema.index({ company: 1, status: 1 });
payrollSchema.index({ company: 1, month: 1 });

const Payroll = mongoose.model('Payroll', payrollSchema);

export default Payroll;

payrollSchema.post('save', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
payrollSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
payrollSchema.post('findOneAndDelete', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
