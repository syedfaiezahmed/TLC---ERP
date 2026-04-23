import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';
import backupPlugin from './plugins/backupPlugin.js';

const feeSchema = mongoose.Schema(
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
    feeNumber: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    items: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        description: { type: String, required: true },
        quantity: { type: Number, required: true, default: 1 },
        price: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        amount: { type: Number, required: true },
        feeType: { 
          type: String, 
          enum: ['admission', 'monthly', 'exam', 'material', 'late_fee', 'other'],
          default: 'monthly'
        },
      },
    ],
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentEnrollment',
    },
    subTotal: {
      type: Number,
      required: true,
      default: 0.0,
    },
    cashDiscount: {
      type: Number,
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
    status: {
      type: String,
      enum: ['paid', 'unpaid', 'partial', 'cancelled'],
      default: 'unpaid',
    },
    paidAmount: {
      type: Number,
      default: 0.0,
    },
    balanceDue: {
      type: Number,
      default: 0.0,
    },
    writeOffAmount: {
      type: Number,
      default: 0.0,
    },
    refundAmount: {
      type: Number,
      default: 0.0,
    },
    voidedAt: {
      type: Date,
    },
    voidReason: {
      type: String,
    },
    lateFeeAmount: {
      type: Number,
      default: 0.0,
    },
    lateFeeApplied: {
      type: Boolean,
      default: false,
    },
    lateFeeRule: {
      amount: { type: Number, default: 200 },
      gracePeriodDays: { type: Number, default: 0 },
    },
    payments: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        method: { type: String, enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'], default: 'Cash' },
        reference: { type: String },
        discount: { type: Number, default: 0.0 }
      }
    ],
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

feeSchema.plugin(backupPlugin);

feeSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});

const Fee = mongoose.model('Fee', feeSchema);

export default Fee;
