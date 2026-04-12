import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const resultSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    marksObtained: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pass', 'Fail', 'Absent'],
      required: true,
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
resultSchema.index({ company: 1, exam: 1, student: 1 }, { unique: true });
resultSchema.index({ company: 1, student: 1, exam: 1 });

const Result = mongoose.model('Result', resultSchema);

export default Result;

resultSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
resultSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
resultSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
