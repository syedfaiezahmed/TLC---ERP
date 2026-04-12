import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const accountSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

accountSchema.index({ company: 1, code: 1 }, { unique: true });
accountSchema.index({ company: 1, name: 1 }, { unique: true });
accountSchema.index({ company: 1, type: 1, name: 1 });

const Account = mongoose.model('Account', accountSchema);

export default Account;

accountSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
accountSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
accountSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});

