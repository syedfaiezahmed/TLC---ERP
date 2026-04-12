import mongoose from 'mongoose';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const companySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    companyId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    address: {
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
    website: {
      type: String,
    },
    taxId: {
      type: String,
    },
    logo: {
      type: String, // URL or Base64
    },
    currency: {
      type: String,
      default: 'PKR',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Company = mongoose.model('Company', companySchema);

export default Company;

companySchema.post('save', function(doc) {
  if (doc?._id) queueCompanyBackupEvent(doc._id);
});
companySchema.post('findOneAndUpdate', function(doc) {
  if (doc?._id) queueCompanyBackupEvent(doc._id);
});
companySchema.post('findOneAndDelete', function(doc) {
  if (doc?._id) queueCompanyBackupEvent(doc._id);
});
