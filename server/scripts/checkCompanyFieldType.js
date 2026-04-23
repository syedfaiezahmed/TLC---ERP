/**
 * Check data type of company field in Ledger
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅  MongoDB connected');

const db = mongoose.connection;
const Ledger = db.collection('ledgers');

const firstFeeRevenue = await Ledger.findOne({ accountName: 'Fee Revenue' });
console.log('\nFirst Fee Revenue entry:');
console.log(`  company: ${firstFeeRevenue.company}`);
console.log(`  company type: ${typeof firstFeeRevenue.company}`);
console.log(`  company constructor: ${firstFeeRevenue.company?.constructor?.name}`);

// Check if string vs ObjectId
const companyIdStr = '69cc2de135caca42d4865263';
const companyIdObj = new mongoose.Types.ObjectId(companyIdStr);

console.log('\nQuerying with string company:');
const withString = await Ledger.find({ accountName: 'Fee Revenue', company: companyIdStr }).limit(3).toArray();
console.log(`  Found: ${withString.length}`);

console.log('\nQuerying with ObjectId company:');
const withObjectId = await Ledger.find({ accountName: 'Fee Revenue', company: companyIdObj }).limit(3).toArray();
console.log(`  Found: ${withObjectId.length}`);

console.log('\nQuerying without company filter:');
const noFilter = await Ledger.find({ accountName: 'Fee Revenue' }).limit(3).toArray();
console.log(`  Found: ${noFilter.length}`);

await mongoose.disconnect();
