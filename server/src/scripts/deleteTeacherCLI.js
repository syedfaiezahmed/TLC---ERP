// deleteTeacherCLI.js – delete a teacher from MongoDB via CLI args
import mongoose from 'mongoose';
import Teacher from '../models/Teacher.js';
import dotenv from 'dotenv';

dotenv.config(); // loads .env from current working directory

const [ , , name, contact ] = process.argv;
if (!name || !contact) {
  console.error('Usage: node deleteTeacherCLI.js <name> <contact>');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not defined in .env');
  process.exit(1);
}

async function deleteTeacher() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'CoachingERP' });
    const result = await Teacher.deleteOne({ name, contact });
    console.log('Delete result:', result);
  } catch (err) {
    console.error('Error deleting teacher:', err);
  } finally {
    await mongoose.disconnect();
  }
}

deleteTeacher();
