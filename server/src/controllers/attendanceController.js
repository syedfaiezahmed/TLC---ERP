import Attendance from '../models/Attendance.js';
import mongoose from 'mongoose';
import { logAudit } from '../services/auditService.js';

// ─── Helper: day-range ────────────────────────────────────────────────────────
const dayRange = (dateStr) => {
  const s = new Date(dateStr); s.setHours(0, 0, 0, 0);
  const e = new Date(dateStr); e.setHours(23, 59, 59, 999);
  return { $gte: s, $lte: e };
};

// @desc    Get attendance logs
// @route   GET /api/attendance
// @access  Private
const getAttendance = async (req, res) => {
  try {
    const { date, type, batch, student, teacher } = req.query;
    const query = { company: req.user.company };

    if (date) query.date = dayRange(date);
    if (type) query.type = type;
    if (batch) query.batch = batch;
    if (student) query.student = student;
    if (teacher) query.teacher = teacher;

    const attendance = await Attendance.find(query)
      .populate('student', 'name studentId email contact')
      .populate('teacher', 'name email contact')
      .populate('batch', 'name startTime endTime')
      .sort({ date: -1 });

    return res.json(attendance);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Mark / update attendance (bulk upsert)
// @route   POST /api/attendance/bulk
// @access  Private
const markAttendanceBulk = async (req, res) => {
  try {
    const { date, type, records, batch } = req.body;
    if (!date || !type || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'date, type and records are required' });
    }

    const companyId = req.user.company;
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const ops = records.map(record => {
      const filter = { company: companyId, date: dateObj, type };
      if (type === 'Student') {
        filter.student = record.student;
        if (batch) filter.batch = batch;
      } else {
        filter.teacher = record.teacher;
      }

      const setData = { status: record.status, remarks: record.remarks || '' };
      if (type === 'Student') { setData.student = record.student; if (batch) setData.batch = batch; }
      else { setData.teacher = record.teacher; }

      return {
        updateOne: {
          filter,
          update: { $set: setData, $setOnInsert: { company: companyId, type, date: dateObj } },
          upsert: true,
        }
      };
    });

    await Attendance.bulkWrite(ops);
    try { await logAudit({ req, companyId, action: 'mark_attendance', entityType: 'attendance', entityId: companyId, before: null, after: { date, type, batch, count: records.length } }); } catch (_) {}

    return res.status(201).json({ message: 'Attendance saved successfully', count: records.length });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete single attendance record
// @route   DELETE /api/attendance/:id
// @access  Private/Admin
const deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findOne({ _id: req.params.id, company: req.user.company });
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });

    const before = record.toObject();
    await record.deleteOne();
    try { await logAudit({ req, companyId: req.user.company, action: 'delete', entityType: 'attendance', entityId: req.params.id, before, after: null }); } catch (_) {}

    return res.json({ message: 'Attendance record deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get monthly attendance register (grid: person × date)
// @route   GET /api/attendance/monthly-register
// @access  Private
const getMonthlyRegister = async (req, res) => {
  try {
    const { year, month, type, batch } = req.query;
    if (!year || !month || !type) {
      return res.status(400).json({ message: 'year, month, and type are required' });
    }

    const y = parseInt(year), m = parseInt(month) - 1;
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 0, 23, 59, 59);

    const query = { company: req.user.company, type, date: { $gte: start, $lte: end } };
    if (batch) query.batch = batch;

    const records = await Attendance.find(query)
      .populate('student', 'name studentId')
      .populate('teacher', 'name')
      .lean();

    // Build days array (1…daysInMonth)
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Group by person
    const personMap = {};
    for (const r of records) {
      const personId = type === 'Student' ? r.student?._id?.toString() : r.teacher?._id?.toString();
      if (!personId) continue;
      if (!personMap[personId]) {
        personMap[personId] = {
          _id: personId,
          name: type === 'Student' ? r.student?.name : r.teacher?.name,
          studentId: r.student?.studentId,
          days: {},
        };
      }
      const day = new Date(r.date).getDate();
      personMap[personId].days[day] = { status: r.status, remarks: r.remarks, _id: r._id };
    }

    return res.json({ days, persons: Object.values(personMap), year: y, month: m + 1 });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get attendance summary report (per-person % in date range)
// @route   GET /api/attendance/report
// @access  Private
const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, type, batch, student, teacher } = req.query;
    if (!startDate || !endDate || !type) {
      return res.status(400).json({ message: 'startDate, endDate, and type are required' });
    }

    const companyId = new mongoose.Types.ObjectId(req.user.company);
    const match = {
      company: companyId,
      type,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };
    if (batch) match.batch = new mongoose.Types.ObjectId(batch);
    if (student) match.student = new mongoose.Types.ObjectId(student);
    if (teacher) match.teacher = new mongoose.Types.ObjectId(teacher);

    const groupId = type === 'Student' ? '$student' : '$teacher';
    const lookupFrom = type === 'Student' ? 'students' : 'teachers';
    const lookupAs   = type === 'Student' ? 'studentInfo' : 'teacherInfo';

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: groupId,
          total:   { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          absent:  { $sum: { $cond: [{ $eq: ['$status', 'Absent'] },  1, 0] } },
          late:    { $sum: { $cond: [{ $eq: ['$status', 'Late'] },    1, 0] } },
          excused: { $sum: { $cond: [{ $eq: ['$status', 'Excused'] }, 1, 0] } },
        }
      },
      {
        $lookup: {
          from: lookupFrom,
          localField: '_id',
          foreignField: '_id',
          as: lookupAs,
        }
      },
      { $unwind: { path: `$${lookupAs}`, preserveNullAndEmpty: true } },
      {
        $project: {
          name:       { $ifNull: [`$${lookupAs}.name`, 'Unknown'] },
          studentId:  { $ifNull: ['$studentInfo.studentId', ''] },
          total:      1, present: 1, absent: 1, late: 1, excused: 1,
          percentage: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: [{ $add: ['$present', '$late'] }, '$total'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { percentage: 1 } }
    ];

    const report = await Attendance.aggregate(pipeline);
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get attendance statistics (today's summary)
// @route   GET /api/attendance/stats
// @access  Private
const getAttendanceStats = async (req, res) => {
  try {
    const { student, teacher, startDate, endDate, type, batch } = req.query;
    const query = { company: req.user.company };

    if (type)    query.type = type;
    if (batch)   query.batch = batch;
    if (student) query.student = student;
    if (teacher) query.teacher = teacher;
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const stats = await Attendance.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export {
  getAttendance,
  markAttendanceBulk,
  deleteAttendance,
  getMonthlyRegister,
  getAttendanceReport,
  getAttendanceStats,
};
