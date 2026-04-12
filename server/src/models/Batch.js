import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const batchSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Course',
    },
    name: {
      type: String,
      required: true,
    },
    startTime: {
      type: String, // e.g., '10:00 AM'
    },
    endTime: {
      type: String, // e.g., '12:00 PM'
    },
    days: [
      {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
    ],
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    status: {
      type: String,
      enum: ['Ongoing', 'Completed', 'Upcoming'],
      default: 'Upcoming',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
batchSchema.index({ company: 1, course: 1 });
batchSchema.index({ company: 1, name: 1 });

const Batch = mongoose.model('Batch', batchSchema);

export default Batch;

batchSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
batchSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
batchSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
