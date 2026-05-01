import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI missing in server/.env');
  process.exit(1);
}

const companyArg = process.argv.find(arg => arg.startsWith('--company='));
const monthArg = process.argv.find(arg => arg.startsWith('--month='));
const month = monthArg?.split('=')[1] || new Date().toISOString().slice(0, 7);
const [year, monthNumber] = month.split('-').map(Number);
const start = new Date(year, monthNumber - 1, 1);
const end = new Date(year, monthNumber, 0, 23, 59, 59, 999);

await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });

const db = mongoose.connection;
const Teachers = db.collection('teachers');
const TeacherClassLogs = db.collection('teacherclasslogs');
const Attendance = db.collection('attendances');
const Payrolls = db.collection('payrolls');

let companyId = companyArg?.split('=')[1];
if (!companyId) {
  const firstTeacher = await Teachers.findOne({});
  companyId = firstTeacher?.company?.toString();
}

if (!companyId) {
  console.error('No company found. Pass --company=<companyId>.');
  process.exit(1);
}

const companyObjectId = new mongoose.Types.ObjectId(companyId);
const teachers = await Teachers.find({
  company: companyObjectId,
  name: { $regex: '(Basit|Hassan)', $options: 'i' },
}).sort({ name: 1 }).toArray();

console.log(`Teacher Payroll/Attendance Audit`);
console.log(`Company: ${companyId}`);
console.log(`Month: ${month}`);
console.log('');

if (teachers.length === 0) {
  console.log('No Basit/Hassan teachers found.');
  process.exit(0);
}

for (const teacher of teachers) {
  const logs = await TeacherClassLogs.find({
    company: companyObjectId,
    teacher: teacher._id,
    date: { $gte: start, $lte: end },
  }).sort({ date: 1 }).toArray();

  const rawAttendance = await Attendance.find({
    company: companyObjectId,
    teacher: teacher._id,
    type: 'Teacher',
    date: { $gte: start, $lte: end },
    classHeld: { $ne: false },
  }).sort({ date: 1 }).toArray();

  const logBatchIds = [...new Set(logs.map(log => log.batch?.toString()).filter(Boolean))].map(id => new mongoose.Types.ObjectId(id));
  const studentAttendance = logBatchIds.length > 0
    ? await Attendance.find({
        company: companyObjectId,
        type: 'Student',
        batch: { $in: logBatchIds },
        date: { $gte: start, $lte: end },
        classHeld: { $ne: false },
      }).sort({ date: 1 }).toArray()
    : [];

  const uniqueAttendance = new Set(rawAttendance.map(rec => {
    const date = rec.date?.toISOString?.().slice(0, 10) || '';
    return `${date}::${rec.course?.toString() || ''}::${rec.batch?.toString() || ''}`;
  }));

  const uniqueStudentSessions = new Set(studentAttendance.map(rec => {
    const date = rec.date?.toISOString?.().slice(0, 10) || '';
    return `${date}::${rec.course?.toString() || ''}::${rec.batch?.toString() || ''}`;
  }));

  const logSessionKeys = logs.map(log => {
    const date = log.date?.toISOString?.().slice(0, 10) || '';
    return `${date}::${log.course?.toString() || ''}::${log.batch?.toString() || ''}`;
  });

  const logsMissingStudentAttendance = logSessionKeys.filter(key => !uniqueStudentSessions.has(key));
  const teacherAttendanceByDate = rawAttendance.reduce((acc, rec) => {
    const date = rec.date?.toISOString?.().slice(0, 10) || '';
    acc[date] = rec.status;
    return acc;
  }, {});
  const eligibleLogCount = logs.filter(log => {
    const date = log.date?.toISOString?.().slice(0, 10) || '';
    return ['Present', 'Late'].includes(teacherAttendanceByDate[date]);
  }).length;

  const payroll = await Payrolls.findOne({
    company: companyObjectId,
    teacher: teacher._id,
    month: { $gte: start, $lt: new Date(year, monthNumber, 1) },
  });

  const payrollCount = payroll?.salaryComponents?.perClassEarnings?.classCount ?? null;
  const payrollAmount = payroll?.salaryComponents?.perClassEarnings?.totalAmount ?? null;

  console.log(`Teacher: ${teacher.name}`);
  console.log(`  Salary Type: ${teacher.salaryType}`);
  console.log(`  TeacherClassLog classes: ${logs.length}`);
  console.log(`  Eligible payroll classes: ${eligibleLogCount}`);
  console.log(`  Raw Attendance records: ${rawAttendance.length}`);
  console.log(`  Unique Attendance sessions: ${uniqueAttendance.size}`);
  console.log(`  Student/batch attendance sessions: ${uniqueStudentSessions.size}`);
  console.log(`  Payroll class count: ${payrollCount === null ? 'NO PAYROLL' : payrollCount}`);
  console.log(`  Payroll per-class amount: ${payrollAmount === null ? 'NO PAYROLL' : payrollAmount}`);

  const daily = logs.reduce((acc, log) => {
    const d = log.date.toISOString().slice(0, 10);
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  console.log('  Class log dates:');
  Object.entries(daily).forEach(([date, count]) => console.log(`    ${date}: ${count} (teacher attendance: ${teacherAttendanceByDate[date] || 'missing'})`));
  if (logsMissingStudentAttendance.length > 0) {
    console.log('  Class logs without matching student/batch attendance:');
    logsMissingStudentAttendance.forEach(key => console.log(`    ${key}`));
  }
  console.log('');
}

await mongoose.disconnect();
