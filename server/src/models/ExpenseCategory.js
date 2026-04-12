import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const expenseCategorySchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String, // e.g., '6001', '6002' for COA structure
      required: true,
    },
    description: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per company
expenseCategorySchema.index({ company: 1, code: 1 }, { unique: true });
expenseCategorySchema.index({ company: 1, name: 1 }, { unique: true });

const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);

export default ExpenseCategory;

expenseCategorySchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
expenseCategorySchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
expenseCategorySchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
