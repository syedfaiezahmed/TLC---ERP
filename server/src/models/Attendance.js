import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const attendanceSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    type: {
      type: String,
      enum: ['Student', 'Teacher'],
      required: true,
      default: 'Student',
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: function() { return this.type === 'Student'; },
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: function() { return this.type === 'Student'; },
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: function() { return this.type === 'Teacher'; },
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    classHeld: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Excused'],
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
attendanceSchema.index({ company: 1, batch: 1, date: 1 });
attendanceSchema.index({ company: 1, student: 1, date: 1 });
attendanceSchema.index({ company: 1, teacher: 1, date: 1 });
attendanceSchema.index({ company: 1, course: 1, date: 1 });
attendanceSchema.index({ company: 1, type: 1, date: 1 });
attendanceSchema.index(
  { company: 1, type: 1, teacher: 1, date: 1 },
  { unique: true, partialFilterExpression: { type: 'Teacher' } }
);
attendanceSchema.index(
  { company: 1, type: 1, student: 1, batch: 1, date: 1 },
  { unique: true, partialFilterExpression: { type: 'Student' } }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;

attendanceSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
attendanceSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
attendanceSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
