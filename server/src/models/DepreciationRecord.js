import mongoose from 'mongoose';

const depreciationRecordSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
      index: true,
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Asset',
      index: true,
    },
    month: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    accumulatedDepreciationBefore: {
      type: Number,
      default: 0,
    },
    accumulatedDepreciationAfter: {
      type: Number,
      default: 0,
    },
    bookValueBefore: {
      type: Number,
      default: 0,
    },
    bookValueAfter: {
      type: Number,
      default: 0,
    },
    journalId: {
      type: String,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

depreciationRecordSchema.index({ company: 1, asset: 1, month: 1 }, { unique: true });

const DepreciationRecord = mongoose.model('DepreciationRecord', depreciationRecordSchema);

export default DepreciationRecord;
