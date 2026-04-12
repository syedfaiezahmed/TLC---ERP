import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const ledgerSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    fee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fee',
    },
    referenceType: {
      type: String,
      enum: [
        'fee',
        'fee_payment',
        'fee_refund',
        'payment',
        'purchase',
        'purchase_return',
        'purchase_payment',
        'teacher_payment',
        'credit_note',
        'debit_note',
        'asset',
        'asset_depreciation',
        'journal_voucher',
        'adjustment',
        'cogs',
        'inventory',
        'service_cost',
        'opening',
        'expense',
        'voucher_payment',
        'payroll',
        'payroll_payment',
        'bad_debt',
        'bad_debt_recovery',
      ],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    reference: {
      type: String, // String reference e.g. check number, transaction ID
    },
    journalId: {
      type: String, // uuid to group balanced lines of a single transaction
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
    debit: {
      type: Number,
      default: 0,
    },
    credit: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: [
        'opening',
        'fee',
        'fee_payment',
        'fee_refund',
        'payment',
        'purchase',
        'purchase_return',
        'purchase_payment',
        'teacher_payment',
        'credit_note',
        'debit_note',
        'asset',
        'asset_depreciation',
        'journal_voucher',
        'tax',
        'adjustment',
        'expense',
        'inventory',
        'cogs',
        'voucher_payment',
        'payroll',
        'payroll_payment',
        'bad_debt',
        'bad_debt_recovery',
      ],
      required: true,
    },
    accountName: {
      type: String,
      required: true, // e.g., 'Accounts Receivable', 'Fee Revenue', 'Cash', 'Institute Assets/Expenses'
    },
    accountType: {
      type: String,
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      default: 'asset' 
    },
    relatedAccount: {
      type: String, // E.g., 'Fee Revenue', 'Accounts Receivable', 'Cash'
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ledgerSchema.index({ company: 1, date: -1 }); // Optimized for latest transactions
ledgerSchema.index({ company: 1, student: 1, date: -1 }); // Optimized for student history
ledgerSchema.index({ company: 1, teacher: 1, date: -1 }); // Optimized for teacher history
ledgerSchema.index({ fee: 1 });
ledgerSchema.index({ accountName: 1 });
// Compound index for recalculation optimization
ledgerSchema.index({ company: 1, accountName: 1, date: 1, createdAt: 1 });
// For Profit & Loss and Balance Sheet performance
ledgerSchema.index({ company: 1, accountType: 1, date: 1 });
// Covered Index for Dashboard Summary (Total Expenses)
ledgerSchema.index({ company: 1, accountType: 1, debit: 1, credit: 1 });
// Journal grouping and references
ledgerSchema.index({ company: 1, journalId: 1 });
ledgerSchema.index({ company: 1, referenceType: 1, referenceId: 1 });
// Fast statements and cash/discount aggregations
ledgerSchema.index({ company: 1, student: 1, accountName: 1, type: 1, date: 1 });
// New: Optimized Payments Report index
ledgerSchema.index({ company: 1, type: 1, date: -1, student: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);

export default Ledger;

ledgerSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
ledgerSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
ledgerSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
