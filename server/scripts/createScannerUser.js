/**
 * One-time script: creates the dedicated attendance scanner account.
 * Run with:  node scripts/createScannerUser.js
 *
 * Credentials:
 *   Email   : attendance.learningcoalition@gmail.com
 *   Password: attendanceTLCatTheRate123
 *   Role    : scanner  (shows ONLY the webcam scanner — no ERP access)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Try server/.env first, then project root .env
dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.MONGO_URI) dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Company from '../src/models/Company.js';

const EMAIL    = 'attendance.learningcoalition@gmail.com';
const PASSWORD = 'attendanceTLCatTheRate123';
const NAME     = 'TLC Attendance Scanner';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find the company this scanner belongs to
  const company = await Company.findOne().sort({ createdAt: 1 }).lean();
  if (!company) {
    console.error('No company found in database. Create a company first.');
    process.exit(1);
  }
  console.log(`Using company: ${company.name} (${company._id})`);

  // Check if user already exists
  const existing = await User.findOne({ email: EMAIL });
  if (existing) {
    console.log(`Scanner user already exists: ${existing.email} (role: ${existing.role})`);
    // Ensure role is correct
    if (existing.role !== 'scanner') {
      existing.role = 'scanner';
      existing.company = company._id;
      await existing.save();
      console.log('Updated existing user role to "scanner"');
    }
    await mongoose.disconnect();
    return;
  }

  // Create new scanner user
  const user = await User.create({
    name: NAME,
    email: EMAIL,
    password: PASSWORD,    // will be hashed by pre-save hook
    role: 'scanner',
    company: company._id,
    isActive: true,
  });

  console.log('\n✅ Scanner user created successfully!');
  console.log('─────────────────────────────────────────');
  console.log(`  Name    : ${user.name}`);
  console.log(`  Email   : ${user.email}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Role    : ${user.role}`);
  console.log(`  Company : ${company.name}`);
  console.log('─────────────────────────────────────────');
  console.log('Login with these credentials to get the scanner-only view.');

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
