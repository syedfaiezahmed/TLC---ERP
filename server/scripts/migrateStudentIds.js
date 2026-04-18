/**
 * migrateStudentIds.js — Assign new TLC-YYNNNN IDs to all students
 *
 * Format: TLC-{2-digit-year}{4-digit-sequence}
 *   e.g.  TLC-260001 (1st student enrolled in 2026)
 *         TLC-260002 (2nd student enrolled in 2026)
 *         TLC-270001 (1st student enrolled in 2027)
 *
 * Ordering: sorted by createdAt ASC then _id ASC within each year.
 *
 * Usage (from d:\TLC\Software\server):
 *   node scripts/migrateStudentIds.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI not set in .env'); process.exit(1); }

await mongoose.connect(MONGO_URI);
console.log('✅ Connected to MongoDB\n');

const Student = mongoose.model('Student', new mongoose.Schema({
  studentId: String,
  createdAt: Date,
  company:   mongoose.Schema.Types.ObjectId,
}, { strict: false, timestamps: true }));

// ── Fetch all students ordered by creation date ───────────────────────────────
const students = await Student.find({})
  .sort({ createdAt: 1, _id: 1 })
  .select('_id studentId createdAt company name')
  .lean();

console.log(`Found ${students.length} students total.\n`);

// ── Group by year ─────────────────────────────────────────────────────────────
const byYear = {};
for (const s of students) {
  const year = new Date(s.createdAt).getFullYear();
  if (!byYear[year]) byYear[year] = [];
  byYear[year].push(s);
}

// ── Preview assignments ───────────────────────────────────────────────────────
console.log('Planned assignments:');
for (const year of Object.keys(byYear).sort()) {
  const yy     = String(year).slice(-2);
  const prefix = `TLC-${yy}`;
  const group  = byYear[year];
  console.log(`\n  ${year} (${group.length} students):`);
  group.forEach((s, i) => {
    const newId = `${prefix}${String(i + 1).padStart(4, '0')}`;
    console.log(`    ${(s.name || '(no name)').padEnd(30)} ${(s.studentId || '—').padEnd(15)} → ${newId}`);
  });
}

// ── Confirm ───────────────────────────────────────────────────────────────────
console.log('\n⚠️  This will overwrite ALL existing student IDs.');
process.stdout.write('Type "yes" to continue: ');

const answer = await new Promise(resolve => {
  process.stdin.once('data', d => resolve(d.toString().trim()));
});

if (answer.toLowerCase() !== 'yes') {
  console.log('Aborted.');
  await mongoose.disconnect();
  process.exit(0);
}

// ── Build and execute bulk write ──────────────────────────────────────────────
const ops = [];
for (const year of Object.keys(byYear).sort()) {
  const yy     = String(year).slice(-2);
  const prefix = `TLC-${yy}`;
  byYear[year].forEach((s, i) => {
    ops.push({
      updateOne: {
        filter: { _id: s._id },
        update: { $set: { studentId: `${prefix}${String(i + 1).padStart(4, '0')}` } },
      },
    });
  });
}

const result = await Student.bulkWrite(ops, { ordered: false });
console.log(`\n✅ Done! Updated ${result.modifiedCount} / ${students.length} students.`);

await mongoose.disconnect();
process.exit(0);
