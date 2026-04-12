import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const periodLockSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
      unique: true,
      index: true,
    },
    lockedUntil: {
      type: Date,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const PeriodLock = mongoose.model('PeriodLock', periodLockSchema);

export default PeriodLock;

periodLockSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
periodLockSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
periodLockSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});

