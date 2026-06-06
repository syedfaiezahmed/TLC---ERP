// findTeacher.js – find a teacher in MongoDB via CLI args
import mongoose from 'mongoose';
import Teacher from '../models/Teacher.js';
import dotenv from 'dotenv';

dotenv.config(); // loads .env from cwd

const [ , , name, contact ] = process.argv;
if (!name || !contact) {
  console.error('Usage: node findTeacher.js <name> <contact>');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not defined in .env');
  process.exit(1);
}

async function findTeacher() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'CoachingERP' });
    const teacher = await Teacher.findOne({ name, contact }).lean();
    if (teacher) {
      console.log('Teacher found:', JSON.stringify(teacher, null, 2));
    } else {
      console.log('No teacher matches the query.');
    }
  } catch (err) {
    console.error('Error finding teacher:', err);
  } finally {
    await mongoose.disconnect();
  }
}

findTeacher();
