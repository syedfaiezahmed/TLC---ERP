// deleteTeacher.js - deletes a specific teacher from MongoDB
// Usage: node deleteTeacher.js

import mongoose from 'mongoose';
import Teacher from '../models/Teacher.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not defined in .env');
  process.exit(1);
}

async function deleteTeacher() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'CoachingERP' });
    const result = await Teacher.deleteOne({ name: 'Miss Umrah', contact: '03022327017' });
    console.log('Delete result:', result);
  } catch (err) {
    console.error('Error deleting teacher:', err);
  } finally {
    await mongoose.disconnect();
  }
}

deleteTeacher();
