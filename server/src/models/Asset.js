import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const assetSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
      index: true,
    },
    assetNumber: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: 'Fixed Asset',
    },
    acquisitionDate: {
      type: Date,
      required: true,
    },
    cost: {
      type: Number,
      required: true,
    },
    salvageValue: {
      type: Number,
      default: 0,
    },
    usefulLifeMonths: {
      type: Number,
      required: true,
    },
    depreciationMethod: {
      type: String,
      enum: ['straight_line'],
      default: 'straight_line',
    },
    assetAccountName: {
      type: String,
      required: true,
    },
    accumulatedDepreciationAccountName: {
      type: String,
      required: true,
    },
    depreciationExpenseAccountName: {
      type: String,
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    acquisitionAccountName: {
      type: String,
      default: 'Cash',
    },
    acquisitionOnCredit: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'disposed'],
      default: 'active',
    },
    accumulatedDepreciation: {
      type: Number,
      default: 0,
    },
    depreciationPostedThrough: {
      type: String,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

assetSchema.index({ company: 1, assetNumber: 1 }, { unique: true });
assetSchema.index({ company: 1, name: 1 });

const Asset = mongoose.model('Asset', assetSchema);

export default Asset;

assetSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
assetSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
assetSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});

