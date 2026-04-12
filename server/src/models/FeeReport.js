import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const feeReportSchema = mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
    },
    reportType: {
      type: String,
      enum: ['student_fee', 'cash_flow', 'class_wise', 'teacher_commission', 'bad_debt', 'voucher_summary'],
      required: true,
    },
    reportName: {
      type: String,
      required: true,
    },
    generatedDate: {
      type: Date,
      default: Date.now,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    period: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    filters: {
      students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
      courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
      batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
      teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
      status: [{ type: String }],
      paymentMethods: [{ type: String }],
    },
    data: {
      summary: {
        totalAssigned: { type: Number, default: 0 },
        totalReceived: { type: Number, default: 0 },
        totalPending: { type: Number, default: 0 },
        totalBadDebt: { type: Number, default: 0 },
        totalDiscount: { type: Number, default: 0 },
        totalLateFee: { type: Number, default: 0 },
        totalRefund: { type: Number, default: 0 },
      },
      details: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
        assignedAmount: { type: Number, default: 0 },
        receivedAmount: { type: Number, default: 0 },
        pendingAmount: { type: Number, default: 0 },
        badDebtAmount: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        lateFeeAmount: { type: Number, default: 0 },
        refundAmount: { type: Number, default: 0 },
        lastPaymentDate: { type: Date },
        status: { type: String },
      }],
      cashFlow: [{
        date: { type: Date },
        description: { type: String },
        income: { type: Number, default: 0 },
        expense: { type: Number, default: 0 },
        balance: { type: Number, default: 0 },
        category: { type: String },
        reference: { type: String },
      }],
      teacherCommissions: [{
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        totalFeesCollected: { type: Number, default: 0 },
        commissionRate: { type: Number, default: 0 },
        commissionAmount: { type: Number, default: 0 },
        students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
      }],
    },
    totals: {
      income: { type: Number, default: 0 },
      expense: { type: Number, default: 0 },
      netCashFlow: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['generated', 'exported', 'emailed'],
      default: 'generated',
    },
    exportFormat: {
      type: String,
      enum: ['pdf', 'excel', 'csv'],
    },
    exportPath: {
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

// Indexes for performance
feeReportSchema.index({ company: 1, reportType: 1 });
feeReportSchema.index({ company: 1, generatedDate: 1 });
feeReportSchema.index({ company: 1, generatedBy: 1 });
feeReportSchema.index({ company: 1, status: 1 });

const FeeReport = mongoose.model('FeeReport', feeReportSchema);

export default FeeReport;

feeReportSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeReportSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
feeReportSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
