import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';
import backupPlugin from './plugins/backupPlugin.js';

const purchaseReturnSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Teacher',
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
    },
    returnNumber: {
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
    reason: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

purchaseReturnSchema.plugin(backupPlugin);
purchaseReturnSchema.index({ company: 1, returnNumber: 1 }, { unique: true });
purchaseReturnSchema.index({ company: 1, teacher: 1, date: -1 });

const PurchaseReturn = mongoose.model('PurchaseReturn', purchaseReturnSchema);

export default PurchaseReturn;

purchaseReturnSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
purchaseReturnSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
purchaseReturnSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
