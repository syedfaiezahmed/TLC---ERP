import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { queueCompanyBackupEvent } from '../utils/backupEvents.js';

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'accountant', 'teacher', 'student', 'user'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    },
  },
  {
    timestamps: true,
  }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

export default User;

userSchema.post('save', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
userSchema.post('findOneAndUpdate', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
userSchema.post('findOneAndDelete', function(doc) {
  if (doc?.company) queueCompanyBackupEvent(doc.company);
});
