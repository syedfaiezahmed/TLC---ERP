import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const teacherClassLogSchema = new mongoose.Schema(
  {
    company:      { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
    teacher:      { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Teacher' },
    date:         { type: Date, required: true },
    batch:        { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Batch' },
    course:       { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Course' },
    subject:      { type: String, default: '' },
    ratePerClass: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

// One class-session per teacher per batch per subject per day
// subject='' is the default (no subject tracking) — still unique per batch+day if no subjects used
teacherClassLogSchema.index({ company: 1, teacher: 1, date: 1, batch: 1, subject: 1 }, { unique: true });
teacherClassLogSchema.index({ company: 1, date: 1 });
teacherClassLogSchema.index({ company: 1, teacher: 1, date: 1 });

// Backup hooks must be registered BEFORE mongoose.model()
teacherClassLogSchema.post('save', function (doc) { if (doc?.company) queueCompanyBackupEvent(doc.company); });
teacherClassLogSchema.post('findOneAndUpdate', function (doc) { if (doc?.company) queueCompanyBackupEvent(doc.company); });
teacherClassLogSchema.post('findOneAndDelete', function (doc) { if (doc?.company) queueCompanyBackupEvent(doc.company); });

const TeacherClassLog = mongoose.model('TeacherClassLog', teacherClassLogSchema);
export default TeacherClassLog;
