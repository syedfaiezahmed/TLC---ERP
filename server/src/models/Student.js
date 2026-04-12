import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const studentSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple students with no ID during migration
    },
    contact: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    address: {
      type: String,
    },
    fatherName: {
      type: String,
    },
    motherName: {
      type: String,
    },
    guardianInfo: {
      type: String,
    },
    emergencyContact: {
      type: String,
    },
    admissionFee: {
      type: Number,
      default: 0,
    },
    admissionFeePaid: {
      type: Boolean,
      default: false,
    },
    admissionFeeDate: {
      type: Date,
    },
    admissionFeeDiscount: {
      type: Number,
      default: 0,
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Completed', 'Dropped'],
      default: 'Active',
    },
    profileImage: {
      type: String,
    },
    documents: [
      {
        title: String,
        url: String,
        uploadDate: { type: Date, default: Date.now },
      },
    ],
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
studentSchema.index({ company: 1, name: 1 });
studentSchema.index({ company: 1, email: 1 });
// For faster search in studentController
studentSchema.index({ name: 'text', email: 'text', contact: 'text' });

const Student = mongoose.model('Student', studentSchema);

export default Student;

studentSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
studentSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
studentSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
