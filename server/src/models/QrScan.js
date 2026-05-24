import mongoose from 'mongoose';

const qrScanSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    userType: {
      type: String,
      enum: ['Student', 'Teacher'],
      required: true,
    },
    userName: { type: String },      // cached for fast display
    userInfo: { type: String },      // batch/course or specialization
    userIdentifier: { type: String },// studentId or teacher contact
    date: {
      type: String,   // 'YYYY-MM-DD' — makes date-based queries trivial
      required: true,
      index: true,
    },
    checkIn: { type: Date },
    checkOut: { type: Date },
    duration: { type: Number, default: 0 },  // minutes
    status: {
      type: String,
      enum: ['present', 'completed'],
      default: 'present',
    },
    lastScanAt: { type: Date },  // for cooldown enforcement
  },
  { timestamps: true }
);

// One record per user per date per company
qrScanSchema.index({ company: 1, date: 1, userId: 1 }, { unique: true });
qrScanSchema.index({ company: 1, date: 1 });
qrScanSchema.index({ company: 1, userId: 1, date: -1 });

const QrScan = mongoose.model('QrScan', qrScanSchema);
export default QrScan;
