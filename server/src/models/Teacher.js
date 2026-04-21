import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const teacherSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    contact: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    address: {
      type: String,
    },
    specialization: {
      type: String,
    },
    salaryType: {
      type: String,
      enum: ['fixed', 'per_class', 'commission', 'hybrid'],
      default: 'fixed',
    },
    annualSalary: {
      type: Number,
      default: 0,
    },
    fixedSalary: {
      type: Number,
      default: 0,
    },
    perClassRates: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
        ratePerClass: { type: Number, required: true },
      },
    ],
    commissionRates: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        percentage: { type: Number, required: true }, // e.g., 15 for 15%
      },
    ],
    bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      bankName: { type: String },
      ifscCode: { type: String },
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
teacherSchema.index({ company: 1, name: 1 });
teacherSchema.index({ company: 1, email: 1 });
teacherSchema.index({ name: 'text', email: 'text', contact: 'text' });

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;

teacherSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
teacherSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
teacherSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
