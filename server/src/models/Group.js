import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

/**
 * Group model — academic stream/discipline under which Courses are organized.
 *
 * Typical Pakistani academic setup:
 *   Pre-Engineering (Phy, Chem, Math)
 *   Pre-Medical     (Phy, Chem, Bio)
 *   Computer Science (Phy, Math, CS)
 *   Commerce        (Accounting, Economics, Business)
 *   Arts / Humanities
 *   General Matric  (for classes 9-10)
 *
 * Hierarchy:  Company → Group → Course → Batch → Students
 */
const groupSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      // e.g. PRE-ENG, PRE-MED, CS, COMM, ARTS, MATRIC
    },
    // Optional classification — which school level this group belongs to
    level: {
      type: String,
      enum: ['Primary', 'Matric', 'Intermediate', 'Bachelor', 'Master', 'Diploma', 'Other'],
      default: 'Intermediate',
    },
    description: {
      type: String,
      trim: true,
    },
    // Free-form list of core subjects in the group (for display/planning only)
    subjects: [{ type: String, trim: true }],
    // UI color for badges/chips (optional)
    color: {
      type: String,
      default: '#1976d2',
    },
    // Sort order for listing
    displayOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Prevent duplicate group name / code within a company.
groupSchema.index({ company: 1, name: 1 }, { unique: true });
groupSchema.index(
  { company: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } }
);
groupSchema.index({ name: 'text', code: 'text', description: 'text' });

groupSchema.post('save', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
groupSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
groupSchema.post('findOneAndDelete', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});

const Group = mongoose.model('Group', groupSchema);
export default Group;
