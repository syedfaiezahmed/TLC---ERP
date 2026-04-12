import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';
import backupPlugin from './plugins/backupPlugin.js';

const expenseSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    category: {
      type: String,
      required: true, // e.g., 'Rent'
    },
    categoryCode: {
      type: String, // e.g., '6001'
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Other'],
      default: 'Cash',
    },
    reference: {
      type: String,
    },
    notes: {
      type: String,
    },
    attachment: {
      type: String, // URL or Base64
    }
  },
  {
    timestamps: true,
  }
);

expenseSchema.plugin(backupPlugin);

// Indexes
expenseSchema.index({ company: 1, date: -1 });
expenseSchema.index({ company: 1, category: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;

expenseSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
expenseSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
expenseSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
