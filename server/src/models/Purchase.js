import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';
import backupPlugin from './plugins/backupPlugin.js';

const purchaseSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: 'Teacher',
    },
    // General purchase fields
    category: {
      type: String,
      enum: ['teacher_payment', 'expense', 'asset'],
      default: 'teacher_payment',
    },
    supplier: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank', 'Credit'],
      default: 'Credit',
    },
    expenseAccountName: {
      type: String,
      default: 'Operating Expenses',
    },
    // If this purchase created an asset, link it
    linkedAsset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
    },
    purchaseNumber: {
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
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        amount: { type: Number, required: true },
      },
    ],
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
      enum: ['paid', 'unpaid', 'partial'],
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
    returnAmount: {
      type: Number,
      default: 0.0,
    },
    payments: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        method: { type: String, enum: ['Cash', 'Bank Transfer', 'Cheque', 'Other'], default: 'Cash' },
        reference: { type: String },
        discount: { type: Number, default: 0.0 },
        journalId: { type: String }
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

purchaseSchema.plugin(backupPlugin);

// Indexes for performance
purchaseSchema.index({ company: 1, purchaseNumber: 1 }, { unique: true });
purchaseSchema.index({ company: 1, date: -1 });
purchaseSchema.index({ company: 1, supplier: 1, status: 1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);

export default Purchase;

purchaseSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
purchaseSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
purchaseSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
