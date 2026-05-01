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
import TeacherClassLog from '../models/TeacherClassLog.js';
import Fee from '../models/Fee.js';
import FeeVoucher from '../models/FeeVoucher.js';
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

const buildAttendanceForCalc = async (companyId, teacherId, start, end) => {
  const sessions = await TeacherClassLog.aggregate([
    {
      $match: {
        company: new mongoose.Types.ObjectId(companyId),
        teacher: new mongoose.Types.ObjectId(teacherId),
        date: { $gte: start, $lte: end },
      },
    },
    {
      $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'courseDoc' },
    },
    {
      $lookup: { from: 'batches', localField: 'batch', foreignField: '_id', as: 'batchDoc' },
    },
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
        batchName:  { $first: { $arrayElemAt: ['$batchDoc.name', 0] } },
      },
    },
  ]);

  // Each element = one class held (unique date+course+batch combo)
  return sessions.map((s) => ({
    classHeld: true,
    date:       s.date,
    course:     s.course,
    batch:      s.batch  || null,
    courseName: s.courseName || 'Unknown Course',
    batchName:  s.batchName  || null,
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

    const existing = await Payroll.findOne({
      company: companyId,
      teacher: teacherId,
      month: { $gte: start, $lt: new Date(start.getFullYear(), start.getMonth() + 1, 1) },
    });

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

    const payload = {
      company: companyId,
      teacher: teacherId,
      month: start,
      salaryType: teacher.salaryType,
      salaryComponents: payrollData,
      totalSalary: payrollData.totalSalary,
      netSalary: payrollData.totalSalary,
      status: 'draft',
    };

    if (existing) {
      if (existing.status !== 'draft') {
        return res.status(400).json({ message: `Payroll already ${existing.status} for ${teacher.name} — ${month}` });
      }
      existing.set(payload);
      const validation = validatePayrollData(existing);
      if (!validation.valid) {
        return res.status(400).json({ message: `Validation failed: ${validation.errors.join(', ')}` });
      }
      const updated = await existing.save();
      void logAudit({ req, companyId, action: 'update', entityType: 'payroll', entityId: updated._id, before: null, after: updated }).catch(() => {});
      await updated.populate('teacher', 'name email contact salaryType fixedSalary annualSalary specialization bankDetails');
      return res.json(updated);
    }

    const payroll = new Payroll(payload);

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

        if (existing) {
          if (existing.status !== 'draft') {
            results.skipped.push({ teacher: teacher.name, reason: `Already ${existing.status}` });
            continue;
          }
          existing.set(payload);
          const payroll = await existing.save();
          results.generated.push({ teacher: teacher.name, totalSalary: payrollData.totalSalary, payrollId: payroll._id, refreshed: true });
        } else {
          const payroll = await Payroll.create(payload);
          results.generated.push({ teacher: teacher.name, totalSalary: payrollData.totalSalary, payrollId: payroll._id });
        }
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
    const { allowances, allowanceDetails, deductions, deductionDetails, notes } = req.body;

    const payroll = await Payroll.findById(req.params.id).populate('company');
    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (!canAccessCompany(req.user, payroll.company)) return res.status(401).json({ message: 'Not authorized' });
    if (payroll.status === 'paid') {
      return res.status(400).json({ message: 'Cannot update paid payroll' });
    }

    const before = payroll.toObject();
    const hasFinancialChange = allowances !== undefined || allowanceDetails || deductions !== undefined || deductionDetails;
    if (hasFinancialChange && payroll.status === 'approved') {
      return res.status(400).json({ message: 'Cannot change allowances/deductions after approval. Delete and re-generate this payroll.' });
    }
    if (allowances !== undefined) payroll.allowances = Number(allowances);
    if (allowanceDetails !== undefined) payroll.allowanceDetails = allowanceDetails;
    if (deductions !== undefined) payroll.deductions = Number(deductions);
    if (deductionDetails !== undefined) payroll.deductionDetails = deductionDetails;
    payroll.netSalary = payroll.totalSalary + (payroll.allowances || 0) - (payroll.deductions || 0);
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

// ─── Get Detailed Print Data (for enhanced payslip) ──────────────────────────

const getPayrollPrintData = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('teacher')
      .populate('company')
      .lean();

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (!canAccessCompany(req.user, payroll.company)) return res.status(401).json({ message: 'Not authorized' });

    const d = new Date(payroll.month);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const { start, end } = monthBounds(monthStr);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const companyId = payroll.company._id;
    const teacher = payroll.teacher;

    let commissionDetail = [];
    let classDetail = [];

    // ─── Commission: student-level fee breakdown per course ──────────────────
    if (payroll.salaryType === 'commission' || payroll.salaryType === 'hybrid') {
      const rateMap = {};
      (teacher.commissionRates || []).forEach(r => {
        const cId = r.course?._id?.toString() || r.course?.toString();
        if (cId) rateMap[cId] = r.percentage || 0;
      });
      const courseIds = Object.keys(rateMap);

      if (courseIds.length > 0) {
        const vouchers = await FeeVoucher.find({
          company: companyId,
          month: { $gte: start, $lt: monthEnd },
          paidAmount: { $gt: 0 },
          'enrollments.course': { $in: courseIds.map(id => new mongoose.Types.ObjectId(id)) },
        }).populate('student', 'name').lean();

        const byCourse = {};
        vouchers.forEach(v => {
          (v.enrollments || []).forEach(enr => {
            const cId = enr.course?.toString();
            if (!cId || !rateMap[cId]) return;
            if (!byCourse[cId]) {
              byCourse[cId] = {
                courseName: enr.courseName || 'Unknown',
                commissionRate: rateMap[cId],
                students: [],
                totalFees: 0,
                totalCommission: 0,
              };
            }
            const prop = v.totalFee > 0 ? enr.netFee / v.totalFee : 0;
            const paid = Math.round(v.paidAmount * prop * 100) / 100;
            const comm = Math.round(paid * rateMap[cId] / 100 * 100) / 100;
            byCourse[cId].students.push({ studentName: v.student?.name || 'Unknown', fees: paid, commissionAmount: comm });
            byCourse[cId].totalFees += paid;
            byCourse[cId].totalCommission += comm;
          });
        });

        commissionDetail = Object.values(byCourse).map(c => ({
          ...c,
          totalFees: Math.round(c.totalFees * 100) / 100,
          totalCommission: Math.round(c.totalCommission * 100) / 100,
        }));
      }
    }

    // ─── Per-Class: day-by-day class sessions ────────────────────────────────
    if (payroll.salaryType === 'per_class' || payroll.salaryType === 'hybrid') {
      const records = await TeacherClassLog.find({
        company: companyId,
        teacher: teacher._id,
        date: { $gte: start, $lte: end },
      })
        .populate('course', 'name')
        .populate('batch', 'name')
        .sort({ date: 1 })
        .lean();

      const teacherAttendanceRecords = await Attendance.find({
        company: companyId,
        teacher: teacher._id,
        type: 'Teacher',
        status: { $in: ['Present', 'Late'] },
        date: { $gte: start, $lte: end },
      }).select('date').lean();
      const validClassDates = new Set(teacherAttendanceRecords.map(r => r.date.toISOString().slice(0, 10)));

      const sessionMap = {};
      records.forEach(rec => {
        const dateStr = rec.date.toISOString().slice(0, 10);
        if (!validClassDates.has(dateStr)) return;
        const courseId = rec.course?._id?.toString() || '';
        const batchId = rec.batch?._id?.toString() || '';
        const key = `${dateStr}::${courseId}::${batchId}`;
        if (sessionMap[key]) return;

        const ac = (teacher.assignedCourses || []).find(r => {
          const acC = r.course?._id?.toString() || r.course?.toString() || '';
          const acB = r.batch?._id?.toString() || r.batch?.toString() || '';
          return acC === courseId && (acB === batchId || !batchId || !acB);
        });
        const pr = (teacher.perClassRates || []).find(r => {
          const prC = r.course?._id?.toString() || r.course?.toString() || '';
          const prB = r.batch?._id?.toString() || r.batch?.toString() || '';
          return prC === courseId && (prB === batchId || !batchId || !prB);
        });
        const rate = ac?.ratePerClass || pr?.ratePerClass || 0;

        sessionMap[key] = {
          date: dateStr,
          courseName: rec.course?.name || 'Unknown',
          batchName: rec.batch?.name || null,
          ratePerClass: rate,
          amount: rate,
        };
      });

      classDetail = Object.values(sessionMap).sort((a, b) => a.date.localeCompare(b.date));
    }

    return res.json({ payroll, commissionDetail, classDetail });
  } catch (error) {
    console.error('[getPayrollPrintData]', error);
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
  getPayrollPrintData,
};
