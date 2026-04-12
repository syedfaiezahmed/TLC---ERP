import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const studentEnrollmentSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Student',
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Course',
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
    },
    enrollmentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Fee Configuration (Original vs Final Fee System)
    originalFee: {
      type: Number,
      required: true,
      description: 'Standard course fee before any discount',
    },
    finalFee: {
      type: Number,
      required: true,
      description: 'Actual fee after admin override/discount',
    },
    discountAmount: {
      type: Number,
      default: 0,
      description: 'Calculated: originalFee - finalFee',
    },
    discountReason: {
      type: String,
    },
    discountApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Legacy fields (kept for backward compatibility)
    monthlyFee: {
      type: Number,
      description: 'Legacy: maps to finalFee',
    },
    dueDay: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
      default: 10,
    },
    discount: {
      type: Number,
      default: 0,
      description: 'Legacy discount field',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed',
    },
    netMonthlyFee: {
      type: Number,
      description: 'Legacy: maps to finalFee',
    },

    // Admission Fee (charged only in first month)
    admissionFee: {
      type: Number,
      default: 1000,
      description: 'One-time admission fee for first month',
    },
    admissionFeeApplied: {
      type: Boolean,
      default: true,
      description: 'Whether to charge admission fee in first voucher',
    },
    admissionFeeCharged: {
      type: Boolean,
      default: false,
      description: 'Tracks if admission fee was already charged',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'dropped', 'suspended', 'on_hold'],
      default: 'active',
    },
    startDate: {
      type: Date,
      required: true,
    },
    expectedEndDate: {
      type: Date,
    },
    actualEndDate: {
      type: Date,
    },
    dropDate: {
      type: Date,
    },
    dropReason: {
      type: String,
    },
    suspensionDate: {
      type: Date,
    },
    suspensionReason: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate discount and sync fields before saving
studentEnrollmentSchema.pre('save', async function () {
  // Handle new fee system
  if (this.isModified('originalFee') || this.isModified('finalFee')) {
    this.discountAmount = this.originalFee - this.finalFee;
    if (this.discountAmount < 0) this.discountAmount = 0;

    // Sync legacy fields for backward compatibility
    this.monthlyFee = this.finalFee;
    this.netMonthlyFee = this.finalFee;
    this.discount = this.discountAmount;
  }

  // Legacy calculation (fallback)
  if (!this.originalFee && (this.isModified('monthlyFee') || this.isModified('discount'))) {
    if (this.discountType === 'percentage') {
      const calculatedDiscount = (this.monthlyFee * this.discount) / 100;
      this.netMonthlyFee = this.monthlyFee - calculatedDiscount;
    } else {
      this.netMonthlyFee = this.monthlyFee - this.discount;
    }
    if (this.netMonthlyFee < 0) this.netMonthlyFee = 0;
  }
});

// Indexes for performance
studentEnrollmentSchema.index({ company: 1, student: 1, course: 1 });
studentEnrollmentSchema.index({ company: 1, status: 1 });
studentEnrollmentSchema.index({ company: 1, course: 1, status: 1 });
studentEnrollmentSchema.index({ student: 1, status: 1 });

// Prevent duplicate active enrollments
studentEnrollmentSchema.index(
  { company: 1, student: 1, course: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  }
);

const StudentEnrollment = mongoose.model('StudentEnrollment', studentEnrollmentSchema);

export default StudentEnrollment;

studentEnrollmentSchema.post('save', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
studentEnrollmentSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
studentEnrollmentSchema.post('findOneAndDelete', function (doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
