/**
 * Payroll Controller — Production-grade payroll engine
 * Supports: fixed, per_class, commission, hybrid salary types
 * Journals: Approve → Dr Salary Expense Cr Salary Payable
 *           Pay     → Dr Salary Payable  Cr Cash/Bank
 */
import mongoose from 'mongoose';
import Payroll from '../models/Payroll.js';
import Teacher from '../models/Teacher.js';
import Attendance from '../models/Attendance.js';
import Fee from '../models/Fee.js';
import Company from '../models/Company.js';
import Ledger from '../models/Ledger.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import { recalculateLedger } from '../services/ledgerService.js';
import {
  postPayrollJournal,
  postPayrollPaymentJournal,
} from '../services/payrollJournalService.js';
import {
  calculateTeacherPayroll,
  getTeacherFeeCollections,
  validatePayrollData,
} from '../utils/payrollCalculations.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const monthBounds = (monthStr) => {
  const d = new Date(monthStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

/**
 * Count distinct class sessions for a teacher in a month.
 * Strategy: group attendance records by (date-string, course) → each group = 1 class session.
 * Uses classHeld:true or any status != 'Absent' to confirm class happened.
 */
const countClassSessions = async (companyId, teacherId, start, end) => {
  const sessions = await Attendance.aggregate([
    {
      $match: {
        company: new mongoose.Types.ObjectId(companyId),
        teacher: new mongoose.Types.ObjectId(teacherId),
        date: { $gte: start, $lte: end },
        classHeld: { $ne: false },
      },
    },
    {
      $group: {
        _id: {
          dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          course: '$course',
        },
        course: { $first: '$course' },
        courseName: { $first: '$courseName' },
      },
    },
    {
      $group: {
        _id: '$_id.course',
        course: { $first: '$course' },
        classCount: { $sum: 1 },
      },
    },
  ]);
  return sessions; // [{ course: ObjectId, classCount: Number }]
};

/**
 * Build attendance array compatible with calculatePerClassEarnings
 * Each entry = one unique class session (course, date).
 */
const buildAttendanceForCalc = async (companyId, teacherId, start, end) => {
  const sessions = await Attendance.aggregate([
    {
      $match: {
        company: new mongoose.Types.ObjectId(companyId),
        teacher: new mongoose.Types.ObjectId(teacherId),
        date: { $gte: start, $lte: end },
        classHeld: { $ne: false },
      },
    },
    {
      $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'courseDoc' },
    },
    {
      $group: {
        _id: {
          dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          course: '$course',
        },
        course: { $first: '$course' },
        courseName: { $first: { $arrayElemAt: ['$courseDoc.name', 0] } },
      },
    },
  ]);

  // Each element = one class held
  return sessions.map((s) => ({
    classHeld: true,
    course: s.course,
    courseName: s.courseName || 'Unknown Course',
  }));
};

// ─── Generate Payroll (Single Teacher) ───────────────────────────────────────

const generatePayroll = async (req, res) => {
  try {
    const { companyId, teacherId, month } = req.body;
    if (!companyId || !teacherId || !month) {
      return res.status(400).json({ message: 'companyId, teacherId, and month are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const teacher = await Teacher.findById(teacherId).populate('perClassRates.course commissionRates.course');
    if (!teacher || teacher.company.toString() !== companyId) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const { start, end } = monthBounds(month);

    // Prevent duplicates
    const existing = await Payroll.findOne({
      company: companyId,
      teacher: teacherId,
      month: { $gte: start, $lt: new Date(start.getFullYear(), start.getMonth() + 1, 1) },
    });
    if (existing) {
      return res.status(400).json({ message: `Payroll already exists for ${teacher.name} — ${month}` });
    }

    // Build attendance array (for per_class / hybrid)
    const attendanceForCalc = await buildAttendanceForCalc(companyId, teacherId, start, end);

    // Get fee collections (for commission / hybrid)
    const teacherCourseIds = [
      ...(teacher.perClassRates || []).map((r) => r.course?._id?.toString() || r.course?.toString()),
      ...(teacher.commissionRates || []).map((r) => r.course?._id?.toString() || r.course?.toString()),
    ].filter(Boolean);

    let feeCollections = [];
    if (teacher.salaryType === 'commission' || teacher.salaryType === 'hybrid') {
      const fees = await Fee.find({
        company: companyId,
        'items.course': { $in: teacherCourseIds },
        'payments.0': { $exists: true },
      })
        .populate('items.course', 'name')
        .lean();
      feeCollections = getTeacherFeeCollections(fees, teacherCourseIds, start);
    }

    // Calculate salary
    const payrollData = calculateTeacherPayroll(teacher, attendanceForCalc, feeCollections);

    const payroll = new Payroll({
      company: companyId,
      teacher: teacherId,
      month: start,
      salaryType: teacher.salaryType,
      salaryComponents: payrollData,
      totalSalary: payrollData.totalSalary,
      netSalary: payrollData.totalSalary,
      status: 'draft',
    });

    const validation = validatePayrollData(payroll);
    if (!validation.valid) {
      return res.status(400).json({ message: `Validation failed: ${validation.errors.join(', ')}` });
    }

    const created = await payroll.save();

    void logAudit({ req, companyId, action: 'create', entityType: 'payroll', entityId: created._id, before: null, after: created }).catch(() => {});

    await created.populate('teacher', 'name email contact salaryType fixedSalary annualSalary specialization bankDetails');
    return res.status(201).json(created);
  } catch (error) {
    console.error('[generatePayroll]', error);
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Bulk Generate (All Teachers) ────────────────────────────────────────────

const generateBulkPayroll = async (req, res) => {
  try {
    const { companyId, month } = req.body;
    if (!companyId || !month) {
      return res.status(400).json({ message: 'companyId and month are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const teachers = await Teacher.find({ company: companyId })
      .populate('perClassRates.course commissionRates.course')
      .lean();

    if (teachers.length === 0) {
      return res.status(400).json({ message: 'No teachers found for this company' });
    }

    const { start, end } = monthBounds(month);
    const results = { generated: [], skipped: [], errors: [] };

    for (const teacher of teachers) {
      try {
        const existing = await Payroll.findOne({
          company: companyId,
          teacher: teacher._id,
          month: { $gte: start, $lt: new Date(start.getFullYear(), start.getMonth() + 1, 1) },
        });

        if (existing) {
          results.skipped.push({ teacher: teacher.name, reason: 'Already exists' });
          continue;
        }

        const attendanceForCalc = await buildAttendanceForCalc(companyId, teacher._id, start, end);

        const teacherCourseIds = [
          ...(teacher.perClassRates || []).map((r) => r.course?._id?.toString() || r.course?.toString()),
          ...(teacher.commissionRates || []).map((r) => r.course?._id?.toString() || r.course?.toString()),
        ].filter(Boolean);

        let feeCollections = [];
        if (teacher.salaryType === 'commission' || teacher.salaryType === 'hybrid') {
          const fees = await Fee.find({
            company: companyId,
            'items.course': { $in: teacherCourseIds },
            'payments.0': { $exists: true },
          })
            .populate('items.course', 'name')
            .lean();
          feeCollections = getTeacherFeeCollections(fees, teacherCourseIds, start);
        }

        const payrollData = calculateTeacherPayroll(teacher, attendanceForCalc, feeCollections);

        const payroll = await Payroll.create({
          company: companyId,
          teacher: teacher._id,
          month: start,
          salaryType: teacher.salaryType,
          salaryComponents: payrollData,
          totalSalary: payrollData.totalSalary,
          netSalary: payrollData.totalSalary,
          status: 'draft',
        });

        results.generated.push({ teacher: teacher.name, totalSalary: payrollData.totalSalary, payrollId: payroll._id });
      } catch (err) {
        results.errors.push({ teacher: teacher.name, error: err.message });
      }
    }

    void logAudit({ req, companyId, action: 'bulk_generate_payroll', entityType: 'payroll', entityId: companyId, before: null, after: results }).catch(() => {});

    return res.status(201).json({
      message: `Payroll generated: ${results.generated.length} new, ${results.skipped.length} skipped, ${results.errors.length} errors`,
      ...results,
    });
  } catch (error) {
    console.error('[generateBulkPayroll]', error);
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Get All Payrolls for Company ─────────────────────────────────────────────

const getPayrollByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, teacherId, month, page = 1, limit = 100 } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const query = { company: companyId };
    if (status && status !== 'all') query.status = status;
    if (teacherId) query.teacher = teacherId;
    if (month) {
      const { start } = monthBounds(month);
      query.month = {
        $gte: start,
        $lt: new Date(start.getFullYear(), start.getMonth() + 1, 1),
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [payrolls, total] = await Promise.all([
      Payroll.find(query)
        .populate('teacher', 'name email contact salaryType fixedSalary annualSalary specialization bankDetails')
        .populate('approvedBy', 'name')
        .sort({ month: -1, createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .lean(),
      Payroll.countDocuments(query),
    ]);

    return res.json({ payrolls, page: Number(page), pages: Math.ceil(total / Number(limit)), total });
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Get Payroll by ID ────────────────────────────────────────────────────────

const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('teacher')
      .populate('company')
      .populate('approvedBy', 'name')
      .populate('salaryComponents.perClassEarnings.breakdown.course', 'name')
      .populate('salaryComponents.commission.breakdown.course', 'name');

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (!canAccessCompany(req.user, payroll.company)) return res.status(401).json({ message: 'Not authorized' });

    return res.json(payroll);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Approve Payroll ─────────────────────────────────────────────────────────
// Journal: Dr Salary Expense  Cr Salary Payable

const approvePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('company');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (!canAccessCompany(req.user, payroll.company)) return res.status(401).json({ message: 'Not authorized' });
    if (payroll.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft payroll can be approved' });
    }

    const before = payroll.toObject();
    payroll.status = 'approved';
    payroll.approvedBy = req.user._id;
    payroll.approvedDate = new Date();
    const updated = await payroll.save();

    // Post accrual journal: Dr Salary Expense  Cr Salary Payable
    try {
      await postPayrollJournal({
        companyId: payroll.company._id,
        teacherId: payroll.teacher,
        payroll: updated,
        date: payroll.approvedDate || new Date(),
        isPaid: false,
      });
    } catch (jErr) {
      console.error('[approvePayroll] journal error:', jErr.message);
    }

    void Promise.all([
      recalculateLedger(payroll.company._id, null, 'Salary Expense'),
      recalculateLedger(payroll.company._id, null, 'Salary Payable'),
    ]).catch(() => {});

    void logAudit({ req, companyId: payroll.company._id, action: 'approve_payroll', entityType: 'payroll', entityId: payroll._id, before, after: updated }).catch(() => {});

    await updated.populate('teacher', 'name email contact salaryType fixedSalary annualSalary specialization bankDetails');
    return res.json(updated);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Record Payroll Payment ───────────────────────────────────────────────────
// Journal: Dr Salary Payable  Cr Cash/Bank

const recordPayrollPayment = async (req, res) => {
  try {
    const { paymentMethod = 'Cash', paymentReference, paymentDate } = req.body;

    const payroll = await Payroll.findById(req.params.id).populate('company');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (!canAccessCompany(req.user, payroll.company)) return res.status(401).json({ message: 'Not authorized' });
    if (payroll.status !== 'approved') {
      return res.status(400).json({ message: 'Payroll must be approved before payment' });
    }

    const before = payroll.toObject();
    const paidDate = paymentDate ? new Date(paymentDate) : new Date();

    payroll.status = 'paid';
    payroll.paidDate = paidDate;
    payroll.paymentMethod = paymentMethod;
    payroll.paymentReference = paymentReference;
    const updated = await payroll.save();

    // Post payment journal: Dr Salary Payable  Cr Cash/Bank
    try {
      await postPayrollPaymentJournal({
        companyId: payroll.company._id,
        teacherId: payroll.teacher,
        payroll: updated,
        paymentAmount: updated.netSalary,
        paymentMethod,
        date: paidDate,
      });
    } catch (jErr) {
      console.error('[recordPayrollPayment] journal error:', jErr.message);
    }

    void Promise.all([
      recalculateLedger(payroll.company._id, null, 'Salary Payable'),
      recalculateLedger(payroll.company._id, null, paymentMethod === 'Cash' ? 'Cash' : 'Bank'),
    ]).catch(() => {});

    void logAudit({ req, companyId: payroll.company._id, action: 'pay_payroll', entityType: 'payroll', entityId: payroll._id, before, after: updated }).catch(() => {});

    await updated.populate('teacher', 'name email contact salaryType fixedSalary annualSalary specialization bankDetails');
    return res.json(updated);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Update Payroll (deductions / notes only) ─────────────────────────────────

const updatePayroll = async (req, res) => {
  try {
    const { deductions, deductionDetails, notes } = req.body;

    const payroll = await Payroll.findById(req.params.id).populate('company');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (!canAccessCompany(req.user, payroll.company)) return res.status(401).json({ message: 'Not authorized' });
    if (payroll.status === 'paid') {
      return res.status(400).json({ message: 'Cannot update paid payroll' });
    }

    const before = payroll.toObject();
    if ((deductions !== undefined || deductionDetails) && payroll.status === 'approved') {
      return res.status(400).json({ message: 'Cannot change deductions after approval. Journal entry is already posted. Delete and re-generate this payroll.' });
    }
    if (deductions !== undefined) {
      payroll.deductions = Number(deductions);
      payroll.netSalary = payroll.totalSalary - Number(deductions);
    }
    if (deductionDetails) payroll.deductionDetails = deductionDetails;
    if (notes !== undefined) payroll.notes = notes;

    const updated = await payroll.save();
    void logAudit({ req, companyId: payroll.company._id, action: 'update', entityType: 'payroll', entityId: payroll._id, before, after: updated }).catch(() => {});

    await updated.populate('teacher', 'name email contact salaryType fixedSalary annualSalary specialization bankDetails');
    return res.json(updated);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Delete Payroll ───────────────────────────────────────────────────────────

const deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('company');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (!canAccessCompany(req.user, payroll.company)) return res.status(401).json({ message: 'Not authorized' });
    if (payroll.status === 'paid') {
      return res.status(400).json({ message: 'Cannot delete paid payroll — reverse it instead' });
    }

    // Reverse journal entries if payroll was approved (journal was posted on approval)
    if (payroll.status === 'approved') {
      await Ledger.deleteMany({ company: payroll.company._id, referenceType: 'payroll', referenceId: payroll._id });
      void Promise.all([
        recalculateLedger(payroll.company._id, null, 'Salary Expense'),
        recalculateLedger(payroll.company._id, null, 'Salary Payable'),
      ]).catch(() => {});
    }

    void logAudit({ req, companyId: payroll.company._id, action: 'delete', entityType: 'payroll', entityId: payroll._id, before: payroll, after: null }).catch(() => {});
    await payroll.deleteOne();
    return res.json({ message: 'Payroll deleted successfully' });
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// ─── Get Payroll Summary for a Month ─────────────────────────────────────────

const getPayrollSummary = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const { start } = monthBounds(month || new Date().toISOString());
    const monthStart = start;
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const [summary] = await Payroll.aggregate([
      { $match: { company: new mongoose.Types.ObjectId(companyId), month: { $gte: monthStart, $lt: monthEnd } } },
      {
        $group: {
          _id: null,
          totalPayroll: { $sum: '$totalSalary' },
          totalNet: { $sum: '$netSalary' },
          totalDeductions: { $sum: '$deductions' },
          count: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$netSalary', 0] } },
          pendingAmount: { $sum: { $cond: [{ $ne: ['$status', 'paid'] }, '$netSalary', 0] } },
        },
      },
    ]);

    return res.json(summary || { totalPayroll: 0, totalNet: 0, totalDeductions: 0, count: 0, paid: 0, approved: 0, draft: 0, paidAmount: 0, pendingAmount: 0 });
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

export {
  generatePayroll,
  generateBulkPayroll,
  getPayrollByCompany,
  getPayrollById,
  approvePayroll,
  recordPayrollPayment,
  updatePayroll,
  deletePayroll,
  getPayrollSummary,
};
