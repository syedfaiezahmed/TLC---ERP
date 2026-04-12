/**
 * resetData.js — Safe Database Reset Script
 *
 * Deletes ALL data EXCEPT:
 *   • users      (login credentials)
 *   • companies  (company settings)
 *
 * Usage (from d:\TLC\Software\server):
 *   node scripts/resetData.js
 *
 * The script will ask for confirmation before deleting anything.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import readline from 'readline';

// ── Collections to wipe (everything except users + companies) ─────────────────
const COLLECTIONS_TO_CLEAR = [
  'accounts',
  'assets',
  'attendances',
  'auditlogs',
  'baddebts',
  'batches',
  'courses',
  'depreciationrecords',
  'enquiries',
  'exams',
  'expenses',
  'expensecategories',
  'feepayments',
  'feerefunds',
  'feereports',
  'feevouchers',
  'fees',
  'ledgers',
  'payrolls',
  'periodlocks',
  'purchases',
  'purchasereturns',
  'results',
  'studentenrollments',
  'students',
  'teachers',
];

// ── Confirmation prompt ───────────────────────────────────────────────────────
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('\n❌  MONGO_URI is not set in .env — aborting.\n');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TLC ERP — Database Reset Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️   This will permanently delete data from:');
  COLLECTIONS_TO_CLEAR.forEach((c) => console.log(`     • ${c}`));
  console.log('\n✅   The following will be KEPT:');
  console.log('     • users     (login credentials)');
  console.log('     • companies (company settings)\n');

  // Allow non-interactive confirmation via --confirm flag
  const autoConfirm = process.argv.includes('--confirm');
  let answer;
  if (autoConfirm) {
    console.log('  --confirm flag detected — proceeding automatically.\n');
    answer = 'yes';
  } else {
    answer = await askConfirmation(
      '  Type  YES  (all caps) to confirm and proceed: '
    );
  }

  if (answer !== 'yes') {
    console.log('\n  Aborted — no data was changed.\n');
    process.exit(0);
  }

  // ── Connect ──────────────────────────────────────────────────────────────
  console.log('\n  Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('  ✓ Connected\n');

  const db = mongoose.connection.db;
  const results = [];

  for (const col of COLLECTIONS_TO_CLEAR) {
    try {
      const res = await db.collection(col).deleteMany({});
      results.push({ collection: col, deleted: res.deletedCount, ok: true });
      console.log(`  ✓  ${col.padEnd(25)} — ${res.deletedCount} documents deleted`);
    } catch (err) {
      results.push({ collection: col, ok: false, error: err.message });
      console.log(`  ⚠  ${col.padEnd(25)} — skipped (${err.message})`);
    }
  }

  const totalDeleted = results.reduce((s, r) => s + (r.deleted || 0), 0);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Done — ${totalDeleted} total documents removed.`);
  console.log('  Users and Companies are untouched.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌  Unexpected error:', err.message);
  process.exit(1);
});
