import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const enquirySchema = mongoose.Schema(
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
    contact: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    courseOfInterest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
    source: {
      type: String,
      enum: ['Social Media', 'Referral', 'Walk-in', 'Website', 'Advertisement', 'Other'],
      default: 'Walk-in',
    },
    status: {
      type: String,
      enum: ['Pending', 'Followed Up', 'Enrolled', 'Closed'],
      default: 'Pending',
    },
    remarks: {
      type: String,
    },
    followUpDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
enquirySchema.index({ company: 1, status: 1 });
enquirySchema.index({ company: 1, followUpDate: 1 });

const Enquiry = mongoose.model('Enquiry', enquirySchema);

export default Enquiry;

enquirySchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
enquirySchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
enquirySchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
