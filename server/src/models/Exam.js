import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const examSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    title: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
    },
    passingMarks: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    remarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
examSchema.index({ company: 1, course: 1, date: 1 });
examSchema.index({ company: 1, batch: 1, date: 1 });

const Exam = mongoose.model('Exam', examSchema);

export default Exam;

examSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
examSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
examSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
