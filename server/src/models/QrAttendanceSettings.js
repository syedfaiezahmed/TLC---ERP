import mongoose from 'mongoose';

const qrAttendanceSettingsSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
    },
    checkoutEnabled: { type: Boolean, default: false },
    cooldownSeconds: { type: Number, default: 60, min: 10, max: 600 },
    autoStart: { type: Boolean, default: false },
    soundEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const QrAttendanceSettings = mongoose.model('QrAttendanceSettings', qrAttendanceSettingsSchema);
export default QrAttendanceSettings;
