import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';
import backupPlugin from './plugins/backupPlugin.js';

const feeRefundSchema = mongoose.Schema(
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
      ref: 'Fee',
    },
    refundNumber: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    items: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        amount: { type: Number, required: true },
      },
    ],
    subTotal: {
      type: Number,
      required: true,
      default: 0.0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0.0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    refundMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
      default: 'Cash',
    },
    reason: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

feeRefundSchema.plugin(backupPlugin);
feeRefundSchema.index({ company: 1, refundNumber: 1 }, { unique: true });
feeRefundSchema.index({ company: 1, student: 1, date: -1 });

const FeeRefund = mongoose.model('FeeRefund', feeRefundSchema);

export default FeeRefund;

feeRefundSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeRefundSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeRefundSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
