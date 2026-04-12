import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const courseSchema = mongoose.Schema(
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
    type: {
      type: String,
      enum: ['course', 'workshop', 'session'],
      default: 'course',
      required: true
    },
    description: {
      type: String,
    },
    fee: {
      type: Number,
      required: true,
      default: 0.0,
    },
    code: {
      type: String,
    },
    duration: {
      type: String,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
courseSchema.index({ company: 1, name: 1 });
courseSchema.index({ company: 1, code: 1 });
// Text index for search
courseSchema.index({ name: 'text', code: 'text', description: 'text' });

const Course = mongoose.model('Course', courseSchema);

export default Course;

courseSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
courseSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
courseSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
