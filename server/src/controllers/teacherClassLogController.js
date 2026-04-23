import mongoose from 'mongoose';
import Attendance      from '../models/Attendance.js';
import Teacher         from '../models/Teacher.js';
import Batch           from '../models/Batch.js';
import TeacherClassLog from '../models/TeacherClassLog.js';
import Payroll         from '../models/Payroll.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import Company from '../models/Company.js';

// ─── Helper ───────────────────────────────────────────────────────────────────
const dayRange = (dateStr) => {
  const s = new Date(dateStr); s.setHours(0, 0, 0, 0);
  const e = new Date(dateStr); e.setHours(23, 59, 59, 999);
  return { $gte: s, $lte: e };
};

// @desc  Get present per-class teachers + their batches + existing logs for a date
// @route GET /api/class-logs/company/:companyId?date=YYYY-MM-DD
const getClassLogs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { date = new Date().toISOString().slice(0, 10) } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    // 1. Find attendance records for teachers marked Present or Late on this date
    const presentRecords = await Attendance.find({
      company: companyId,
      type: 'Teacher',
      status: { $in: ['Present', 'Late'] },
      date: dayRange(date),
    }).select('teacher').lean();

    if (presentRecords.length === 0) return res.json([]);

    const presentTeacherIds = [...new Set(presentRecords.map(r => r.teacher.toString()))];

    // 2. Fetch those teachers with salaryType per_class or hybrid
    const teachers = await Teacher.find({
      _id: { $in: presentTeacherIds },
      company: companyId,
      salaryType: { $in: ['per_class', 'hybrid'] },
    })
      .populate('perClassRates.course', 'name')
      .populate('assignedCourses.course', 'name')
      .populate('assignedCourses.batch', 'name course')
      .lean();

    if (teachers.length === 0) return res.json([]);

    // 3. Fetch batches from teachers' assignedCourses (batch field)
    const allBatchIds = [...new Set(
      teachers.flatMap(t => (t.assignedCourses || []).filter(ac => ac.batch).map(ac => ac.batch?._id?.toString() || ac.batch.toString()))
    )];
    const batches = allBatchIds.length > 0
      ? await Batch.find({
          company: companyId,
          _id: { $in: allBatchIds },
          status: { $in: ['Ongoing', 'Upcoming'] },
        }).populate('course', 'name').lean()
      : [];

    // 4. Fetch existing class logs for this date
    const dateObj = new Date(date); dateObj.setHours(0, 0, 0, 0);
    const existingLogs = await TeacherClassLog.find({
      company: companyId,
      date: dayRange(date),
      teacher: { $in: teachers.map(t => t._id) },
    }).lean();

    const logSet = new Set(existingLogs.map(l => `${l.teacher}-${l.batch}`));

    // 5. Build response: one entry per teacher with their batches
    const result = teachers.map(teacher => {
      const teacherBatchIds = new Set(
        (teacher.assignedCourses || []).filter(ac => ac.batch).map(ac => ac.batch?._id?.toString() || ac.batch.toString())
      );
      const teacherBatches = batches.filter(b => teacherBatchIds.has(b._id.toString()));
      return {
        teacher: { _id: teacher._id, name: teacher.name, email: teacher.email, salaryType: teacher.salaryType },
        perClassRates: teacher.perClassRates,
        batches: teacherBatches.map(b => {
          const bIdStr = b._id.toString();
          const ac = (teacher.assignedCourses || []).find(r => (r.batch?._id?.toString() || r.batch?.toString()) === bIdStr);
          const fallbackRate = (
            (teacher.perClassRates || []).find(r =>
              r.course?._id?.toString() === b.course?._id?.toString() &&
              r.batch?.toString() === bIdStr
            ) ||
            (teacher.perClassRates || []).find(r =>
              r.course?._id?.toString() === b.course?._id?.toString() && !r.batch
            )
          );
          return {
            _id: b._id,
            name: b.name,
            course: b.course,
            ratePerClass: ac?.ratePerClass || fallbackRate?.ratePerClass || 0,
            logged: logSet.has(`${teacher._id}-${b._id}`),
          };
        }),
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('getClassLogs error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

// @desc  Save class logs for one teacher on one date (replaces existing)
// @route POST /api/class-logs
const saveClassLogs = async (req, res) => {
  try {
    const { companyId, teacherId, date, batchIds = [] } = req.body;
    if (!companyId || !teacherId || !date) {
      return res.status(400).json({ message: 'companyId, teacherId and date are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const teacher = await Teacher.findOne({ _id: teacherId, company: companyId }).lean();
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const dateObj = new Date(date); dateObj.setHours(0, 0, 0, 0);

    // Delete existing logs for this teacher on this date
    await TeacherClassLog.deleteMany({ company: companyId, teacher: teacherId, date: dayRange(date) });

    if (batchIds.length === 0) return res.json({ message: 'Class logs cleared', count: 0 });

    // Fetch the batches to get course info
    const batches = await Batch.find({ _id: { $in: batchIds }, company: companyId }).lean();

    const docs = batches.map(b => {
      const rate = (
        teacher.perClassRates.find(r =>
          r.course?.toString() === b.course?.toString() &&
          r.batch?.toString() === b._id?.toString()
        ) ||
        teacher.perClassRates.find(r =>
          r.course?.toString() === b.course?.toString() && !r.batch
        )
      );
      return {
        company:      companyId,
        teacher:      teacherId,
        date:         dateObj,
        batch:        b._id,
        course:       b.course,
        ratePerClass: rate?.ratePerClass || 0,
      };
    });

    const created = await TeacherClassLog.insertMany(docs, { ordered: false });
    return res.status(201).json({ message: 'Class logs saved', count: created.length });
  } catch (error) {
    console.error('saveClassLogs error:', error.message);
    return res.status(400).json({ message: error.message });
  }
};

// @desc  Get monthly class log summary per teacher
// @route GET /api/class-logs/monthly/:companyId?month=YYYY-MM
const getMonthlySummary = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month = new Date().toISOString().slice(0, 7) } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const [yr, mo] = month.split('-').map(Number);
    const start = new Date(yr, mo - 1, 1);
    const end   = new Date(yr, mo, 0, 23, 59, 59, 999);

    const summary = await TeacherClassLog.aggregate([
      { $match: { company: new mongoose.Types.ObjectId(companyId), date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { teacher: '$teacher', course: '$course' },
          classCount:   { $sum: 1 },
          ratePerClass: { $first: '$ratePerClass' },
          amount:       { $sum: '$ratePerClass' },
        },
      },
      {
        $lookup: { from: 'teachers', localField: '_id.teacher', foreignField: '_id', as: 'teacherInfo' },
      },
      { $unwind: { path: '$teacherInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: { from: 'courses', localField: '_id.course', foreignField: '_id', as: 'courseInfo' },
      },
      { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id.teacher',
          name:  { $first: '$teacherInfo.name' },
          email: { $first: '$teacherInfo.email' },
          breakdown: {
            $push: {
              course:       '$_id.course',
              courseName:   { $ifNull: ['$courseInfo.name', 'Unknown'] },
              classCount:   '$classCount',
              ratePerClass: '$ratePerClass',
              amount:       '$amount',
            },
          },
          totalClasses: { $sum: '$classCount' },
          totalAmount:  { $sum: '$amount' },
        },
      },
      { $sort: { name: 1 } },
    ]);

    return res.json(summary);
  } catch (error) {
    console.error('getMonthlySummary error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

// @desc  Generate / refresh payroll for per-class teachers from monthly logs
// @route POST /api/class-logs/generate-payroll/:companyId
const generatePayrollFromLogs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month } = req.body; // 'YYYY-MM'
    if (!month) return res.status(400).json({ message: 'month (YYYY-MM) is required' });

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const [yr, mo] = month.split('-').map(Number);
    const start = new Date(yr, mo - 1, 1);
    const end   = new Date(yr, mo, 0, 23, 59, 59, 999);

    const summary = await TeacherClassLog.aggregate([
      { $match: { company: new mongoose.Types.ObjectId(companyId), date: { $gte: start, $lte: end } } },
      { $group: { _id: { teacher: '$teacher', course: '$course' }, classCount: { $sum: 1 }, ratePerClass: { $first: '$ratePerClass' }, amount: { $sum: '$ratePerClass' } } },
      { $lookup: { from: 'courses', localField: '_id.course', foreignField: '_id', as: 'courseInfo' } },
      { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$_id.teacher', breakdown: { $push: { course: '$_id.course', courseName: { $ifNull: ['$courseInfo.name', 'Unknown'] }, classCount: '$classCount', ratePerClass: '$ratePerClass', amount: '$amount' } }, totalClasses: { $sum: '$classCount' }, totalAmount: { $sum: '$amount' } } },
    ]);

    const monthDate = new Date(yr, mo - 1, 1);
    let created = 0, updated = 0;

    for (const row of summary) {
      const teacher = await Teacher.findById(row._id).lean();
      if (!teacher) continue;

      const payload = {
        company:    companyId,
        teacher:    row._id,
        month:      monthDate,
        salaryType: teacher.salaryType,
        'salaryComponents.perClassEarnings': {
          classCount:  row.totalClasses,
          totalAmount: row.totalAmount,
          breakdown:   row.breakdown,
        },
        'salaryComponents.fixedSalary.amount': teacher.salaryType === 'hybrid' ? (teacher.fixedSalary || 0) : 0,
        totalSalary: row.totalAmount + (teacher.salaryType === 'hybrid' ? (teacher.fixedSalary || 0) : 0),
        netSalary:   row.totalAmount + (teacher.salaryType === 'hybrid' ? (teacher.fixedSalary || 0) : 0),
        status: 'draft',
      };

      const existing = await Payroll.findOne({ company: companyId, teacher: row._id, month: monthDate });
      if (existing) {
        if (existing.status === 'paid') continue; // Never overwrite paid payrolls
        Object.assign(existing, payload);
        await existing.save();
        updated++;
      } else {
        await Payroll.create(payload);
        created++;
      }
    }

    return res.json({ message: `Payroll generated: ${created} created, ${updated} updated`, created, updated });
  } catch (error) {
    console.error('generatePayrollFromLogs error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

export { getClassLogs, saveClassLogs, getMonthlySummary, generatePayrollFromLogs };
