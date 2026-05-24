import mongoose from 'mongoose';

const qrTokenSchema = new mongoose.Schema(
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
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    qrDataUrl: {
      type: String,  // base64 PNG data URL
    },
  },
  { timestamps: true }
);

// One QR per user per company
qrTokenSchema.index({ company: 1, userId: 1, userType: 1 }, { unique: true });

const QrToken = mongoose.model('QrToken', qrTokenSchema);
export default QrToken;
