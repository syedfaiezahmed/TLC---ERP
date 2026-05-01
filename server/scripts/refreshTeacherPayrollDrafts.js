import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Attendance from '../src/models/Attendance.js';
import Batch from '../src/models/Batch.js';
import Company from '../src/models/Company.js';
import Course from '../src/models/Course.js';
import FeeVoucher from '../src/models/FeeVoucher.js';
import Payroll from '../src/models/Payroll.js';
import Teacher from '../src/models/Teacher.js';
import TeacherClassLog from '../src/models/TeacherClassLog.js';
import { calculateTeacherPayroll, getTeacherVoucherCollections } from '../src/utils/payrollCalculations.js';

void Batch;
void Course;

dotenv.config();

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));

const monthBounds = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const buildAttendanceForCalc = async (companyId, teacherId, start, end) => {
  const sessions = await TeacherClassLog.aggregate([
    {
      $match: {
        company: new mongoose.Types.ObjectId(companyId),
        teacher: new mongoose.Types.ObjectId(teacherId),
        date: { $gte: start, $lte: end },
      },
    },
    { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'courseDoc' } },
    { $lookup: { from: 'batches', localField: 'batch', foreignField: '_id', as: 'batchDoc' } },
    {
      $lookup: {
        from: 'attendances',
        let: { logCompany: '$company', logTeacher: '$teacher', logDate: '$date' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$company', '$$logCompany'] },
                  { $eq: ['$teacher', '$$logTeacher'] },
                  { $eq: ['$type', 'Teacher'] },
                  { $in: ['$status', ['Present', 'Late']] },
                  {
                    $eq: [
                      { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                      { $dateToString: { format: '%Y-%m-%d', date: '$$logDate' } },
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: 'teacherAttendance',
      },
    },
    { $match: { 'teacherAttendance.0': { $exists: true } } },
    {
      $group: {
        _id: {
          dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          course: '$course',
          batch: '$batch',
        },
        date: { $first: '$date' },
        course: { $first: '$course' },
        batch: { $first: '$batch' },
        courseName: { $first: { $arrayElemAt: ['$courseDoc.name', 0] } },
        batchName: { $first: { $arrayElemAt: ['$batchDoc.name', 0] } },
      },
    },
  ]);

  return sessions.map(session => ({
    classHeld: true,
    date: session.date,
    course: session.course,
    batch: session.batch || null,
    courseName: session.courseName || 'Unknown Course',
    batchName: session.batchName || null,
  }));
};

const main = async () => {
  const month = args.month;
  const companyId = args.company;
  if (!month || !companyId) throw new Error('Usage: node scripts/refreshTeacherPayrollDrafts.js --company=<companyId> --month=YYYY-MM');

  await mongoose.connect(process.env.MONGO_URI);
  const company = await Company.findById(companyId).lean();
  if (!company) throw new Error(`Company not found: ${companyId}`);

  const { start, end } = monthBounds(month);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const teachers = await Teacher.find({ company: companyId }).populate('perClassRates.course commissionRates.course').lean();
  const results = [];

  for (const teacher of teachers) {
    const attendanceForCalc = await buildAttendanceForCalc(companyId, teacher._id, start, end);
    const teacherCourseIds = [
      ...(teacher.perClassRates || []).map(rate => rate.course?._id?.toString() || rate.course?.toString()),
      ...(teacher.commissionRates || []).map(rate => rate.course?._id?.toString() || rate.course?.toString()),
    ].filter(Boolean);

    let feeCollections = [];
    if (teacher.salaryType === 'commission' || teacher.salaryType === 'hybrid') {
      const vouchers = await FeeVoucher.find({
        company: companyId,
        month: { $gte: start, $lt: monthEnd },
        paidAmount: { $gt: 0 },
        'enrollments.course': { $in: teacherCourseIds.map(id => new mongoose.Types.ObjectId(id)) },
      }).lean();
      feeCollections = getTeacherVoucherCollections(vouchers, teacherCourseIds);
    }

    const payrollData = calculateTeacherPayroll(teacher, attendanceForCalc, feeCollections);
    const payload = {
      company: companyId,
      teacher: teacher._id,
      month: start,
      salaryType: teacher.salaryType,
      salaryComponents: payrollData,
      totalSalary: payrollData.totalSalary,
      netSalary: payrollData.totalSalary,
      status: 'draft',
    };

    const existing = await Payroll.findOne({ company: companyId, teacher: teacher._id, month: { $gte: start, $lt: monthEnd } });
    if (existing && existing.status !== 'draft') {
      results.push({ teacher: teacher.name, status: 'skipped', reason: `Already ${existing.status}` });
      continue;
    }

    if (existing) {
      existing.set(payload);
      await existing.save();
      results.push({ teacher: teacher.name, status: 'refreshed', classes: payrollData.perClassEarnings.classCount, amount: payrollData.totalSalary });
    } else if (payrollData.totalSalary > 0 || ['fixed', 'hybrid'].includes(teacher.salaryType)) {
      await Payroll.create(payload);
      results.push({ teacher: teacher.name, status: 'created', classes: payrollData.perClassEarnings.classCount, amount: payrollData.totalSalary });
    }
  }

  console.table(results);
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
