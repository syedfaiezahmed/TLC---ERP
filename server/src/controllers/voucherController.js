import FeeVoucher from '../models/FeeVoucher.js';
import StudentEnrollment from '../models/StudentEnrollment.js';
import Student from '../models/Student.js';
import Company from '../models/Company.js';
import Fee from '../models/Fee.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import { generateVoucherNumber, calculateTotalFee } from '../utils/feeCalculations.js';

// @desc    Generate fee voucher for a student for a specific month
// @route   POST /api/vouchers/generate
// @access  Private/Admin
const generateVeeVoucher = async (req, res) => {
  try {
    const { companyId, studentId, month, lateFeeAmount } = req.body;

    // Verify company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Verify student
    const student = await Student.findById(studentId);
    if (!student || student.company.toString() !== companyId) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get student's active enrollments
    const enrollments = await StudentEnrollment.find({
      company: companyId,
      student: studentId,
      status: 'active',
    }).populate('course');

    if (enrollments.length === 0) {
      return res.status(400).json({ message: 'Student has no active enrollments' });
    }

    // Check if voucher already exists for this month
    const voucherMonth = new Date(month);
    const existingVoucher = await FeeVoucher.findOne({
      company: companyId,
      student: studentId,
      month: {
        $gte: new Date(voucherMonth.getFullYear(), voucherMonth.getMonth(), 1),
        $lt: new Date(voucherMonth.getFullYear(), voucherMonth.getMonth() + 1, 1),
      },
      status: { $ne: 'cancelled' },
    });

    if (existingVoucher) {
      return res.status(400).json({ message: 'Voucher already exists for this month' });
    }

    // Get last voucher number
    const lastVoucher = await FeeVoucher.findOne({ company: companyId })
      .sort({ createdAt: -1 })
      .limit(1);

    const lastNumber = lastVoucher ? parseInt(lastVoucher.voucherNumber.split('-').pop()) : 0;
    const voucherNumber = generateVoucherNumber(companyId, lastNumber, voucherMonth);

    // Prepare enrollment data for voucher
    const voucherEnrollments = enrollments.map((enrollment) => ({
      enrollment: enrollment._id,
      course: enrollment.course._id,
      courseName: enrollment.course.name,
      monthlyFee: enrollment.monthlyFee,
      discount: enrollment.discount,
      netFee: enrollment.netMonthlyFee,
    }));

    const totalFee = calculateTotalFee(voucherEnrollments);

    // Determine due date (use the earliest dueDay from enrollments)
    const earliestDueDay = Math.min(...enrollments.map((e) => e.dueDay));
    const dueDate = new Date(voucherMonth.getFullYear(), voucherMonth.getMonth(), earliestDueDay);

    // Create voucher
    const voucher = new FeeVoucher({
      company: companyId,
      voucherNumber,
      student: studentId,
      month: voucherMonth,
      enrollments: voucherEnrollments,
      totalFee,
      dueDate,
      lateFeeAmount: lateFeeAmount || 200,
      generatedBy: req.user._id,
    });

    const createdVoucher = await voucher.save();
    await logAudit({
      req,
      companyId,
      action: 'create',
      entityType: 'voucher',
      entityId: createdVoucher._id,
      before: null,
      after: createdVoucher,
    });

    await createdVoucher.populate(['student', 'enrollments.course']);

    res.status(201).json(createdVoucher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all vouchers for a company
// @route   GET /api/vouchers/company/:companyId
// @access  Private
const getVouchersByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, studentId, month, page = 1, limit = 50 } = req.query;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const query = { company: companyId };
    if (status) query.status = status;
    if (studentId) query.student = studentId;
    if (month) {
      const voucherMonth = new Date(month);
      query.month = {
        $gte: new Date(voucherMonth.getFullYear(), voucherMonth.getMonth(), 1),
        $lt: new Date(voucherMonth.getFullYear(), voucherMonth.getMonth() + 1, 1),
      };
    }

    const skip = (page - 1) * limit;

    const [vouchers, total] = await Promise.all([
      FeeVoucher.find(query)
        .populate('student', 'name email contact')
        .populate('enrollments.course', 'name')
        .sort({ month: -1, voucherNumber: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      FeeVoucher.countDocuments(query),
    ]);

    res.json({
      vouchers,
      page: Number(page),
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get voucher by ID
// @route   GET /api/vouchers/:id
// @access  Private
const getVoucherById = async (req, res) => {
  try {
    const voucher = await FeeVoucher.findById(req.params.id)
      .populate('student')
      .populate('company')
      .populate('enrollments.course')
      .populate('fee');

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    if (!canAccessCompany(req.user, voucher.company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(voucher);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// @desc    Record payment for voucher
// @route   POST /api/vouchers/:id/payment
// @access  Private/Admin
const recordVoucherPayment = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentReference, paymentDate } = req.body;

    const voucher = await FeeVoucher.findById(req.params.id).populate('company');

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    if (!canAccessCompany(req.user, voucher.company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (voucher.status === 'paid') {
      return res.status(400).json({ message: 'Voucher is already paid' });
    }

    if (voucher.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot record payment for cancelled voucher' });
    }

    const before = { ...voucher.toObject() };

    // Update voucher
    voucher.paidAmount = (voucher.paidAmount || 0) + amount;
    voucher.paidDate = paymentDate || new Date();
    voucher.paymentMethod = paymentMethod;
    voucher.paymentReference = paymentReference;

    // Determine applicable amount (with late fee if overdue)
    const applicableAmount = voucher.getApplicableAmount();

    if (voucher.paidAmount >= applicableAmount) {
      voucher.status = 'paid';
    } else if (voucher.paidAmount > 0) {
      voucher.status = 'partial';
    }

    const updatedVoucher = await voucher.save();
    await logAudit({
      req,
      companyId: voucher.company._id,
      action: 'update',
      entityType: 'voucher',
      entityId: voucher._id,
      before,
      after: updatedVoucher,
    });

    await updatedVoucher.populate(['student', 'enrollments.course']);

    res.json(updatedVoucher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Cancel voucher
// @route   PUT /api/vouchers/:id/cancel
// @access  Private/Admin
const cancelVoucher = async (req, res) => {
  try {
    const voucher = await FeeVoucher.findById(req.params.id).populate('company');

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    if (!canAccessCompany(req.user, voucher.company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (voucher.status === 'paid') {
      return res.status(400).json({ message: 'Cannot cancel paid voucher' });
    }

    const before = { ...voucher.toObject() };

    voucher.status = 'cancelled';
    const updatedVoucher = await voucher.save();

    await logAudit({
      req,
      companyId: voucher.company._id,
      action: 'update',
      entityType: 'voucher',
      entityId: voucher._id,
      before,
      after: updatedVoucher,
    });

    res.json(updatedVoucher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get overdue vouchers
// @route   GET /api/vouchers/company/:companyId/overdue
// @access  Private
const getOverdueVouchers = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!canAccessCompany(req.user, company)) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueVouchers = await FeeVoucher.find({
      company: companyId,
      dueDate: { $lt: today },
      status: { $in: ['pending', 'partial'] },
    })
      .populate('student', 'name email contact')
      .populate('enrollments.course', 'name')
      .sort({ dueDate: 1 })
      .lean();

    res.json(overdueVouchers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  generateVeeVoucher,
  getVouchersByCompany,
  getVoucherById,
  recordVoucherPayment,
  cancelVoucher,
  getOverdueVouchers,
};
