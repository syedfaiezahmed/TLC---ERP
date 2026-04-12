import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const badDebtSchema = mongoose.Schema(
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
      required: true,
      ref: 'Fee',
    },
    voucher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeVoucher',
    },
    originalAmount: {
      type: Number,
      required: true,
    },
    writtenOffAmount: {
      type: Number,
      required: true,
    },
    writeOffDate: {
      type: Date,
      default: Date.now,
    },
    writeOffReason: {
      type: String,
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['written_off', 'recovered', 'partial_recovered'],
      default: 'written_off',
    },
    recoveredAmount: {
      type: Number,
      default: 0,
    },
    recoveryDate: {
      type: Date,
    },
    recoveryNotes: {
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

// Indexes for performance
badDebtSchema.index({ company: 1, student: 1 });
badDebtSchema.index({ company: 1, status: 1 });
badDebtSchema.index({ company: 1, writeOffDate: 1 });
badDebtSchema.index({ company: 1, academicYear: 1 });

const BadDebt = mongoose.model('BadDebt', badDebtSchema);

export default BadDebt;

badDebtSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
badDebtSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
badDebtSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
