import StudentEnrollment from '../models/StudentEnrollment.js';
import Student from '../models/Student.js';
import Course from '../models/Course.js';
import Batch from '../models/Batch.js';
import Company from '../models/Company.js';
import { logAudit } from '../services/auditService.js';
import { canAccessCompany } from '../utils/companyAccess.js';

// @desc    Create a new student enrollment
// @route   POST /api/enrollments
// @access  Private/Admin
const createEnrollment = async (req, res) => {
  try {
    const {
      companyId,
      studentId,
      courseId,
      batchId,
      enrollmentDate,
      // New fee fields
      originalFee,
      finalFee,
      discountReason,
      // Legacy fields (still supported)
      monthlyFee,
      dueDay,
      discount,
      discountType,
      startDate,
      expectedEndDate,
      notes,
      // Admission fee
      admissionFee,
      admissionFeeApplied,
    } = req.body;

    // Verify company
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    // Verify student
    const student = await Student.findById(studentId);
    if (!student || student.company.toString() !== companyId) return res.status(404).json({ message: 'Student not found' });

    // Verify course
    const course = await Course.findById(courseId);
    if (!course || course.company.toString() !== companyId) return res.status(404).json({ message: 'Course not found' });

    // Check for duplicate active enrollment
    const existingEnrollment = await StudentEnrollment.findOne({
      company: companyId,
      student: studentId,
      course: courseId,
      status: 'active',
    });
    if (existingEnrollment) return res.status(400).json({ message: 'Student is already enrolled in this course' });

    // Determine fee values (new system or legacy fallback)
    const courseOriginalFee = originalFee || course.fee;
    const courseFinalFee = finalFee || monthlyFee || course.fee;

    // Create enrollment with new fee system
    const enrollment = new StudentEnrollment({
      company: companyId,
      student: studentId,
      course: courseId,
      batch: batchId,
      enrollmentDate: enrollmentDate || new Date(),
      // New fee system
      originalFee: courseOriginalFee,
      finalFee: courseFinalFee,
      discountReason,
      discountApprovedBy: req.user._id,
      // Legacy fields (synced via pre-save hook)
      monthlyFee: courseFinalFee,
      dueDay: dueDay || 10,
      discount: courseOriginalFee - courseFinalFee,
      discountType: discountType || 'fixed',
      // Admission fee
      admissionFee: admissionFee !== undefined ? admissionFee : 1000,
      admissionFeeApplied: admissionFeeApplied !== undefined ? admissionFeeApplied : true,
      admissionFeeCharged: false,
      // Dates
      startDate: startDate || new Date(),
      expectedEndDate,
      notes,
    });

    const createdEnrollment = await enrollment.save();
    try { await logAudit({ req, companyId, action: 'create', entityType: 'enrollment', entityId: createdEnrollment._id, before: null, after: createdEnrollment }); } catch(_) {}

    await createdEnrollment.populate(['student', 'course', 'batch']);
    return res.status(201).json(createdEnrollment);
  } catch (error) {
    console.error('[createEnrollment] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Get all enrollments for a company
// @route   GET /api/enrollments/company/:companyId
// @access  Private
const getEnrollmentsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, studentId, courseId, page = 1, limit = 50 } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const query = { company: companyId };
    if (status) query.status = status;
    if (studentId) query.student = studentId;
    if (courseId) query.course = courseId;

    const skip = (page - 1) * limit;

    const [enrollments, total] = await Promise.all([
      StudentEnrollment.find(query)
        .populate('student', 'name email contact')
        .populate('course', 'name fee')
        .populate('batch', 'name')
        .sort({ enrollmentDate: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      StudentEnrollment.countDocuments(query),
    ]);

    res.json({
      enrollments,
      page: Number(page),
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get enrollments for a specific student
// @route   GET /api/enrollments/student/:studentId
// @access  Private
const getEnrollmentsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const company = await Company.findById(student.company);
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const query = { student: studentId };
    if (status) query.status = status;

    const enrollments = await StudentEnrollment.find(query)
      .populate('course', 'name fee description')
      .populate('batch', 'name startTime endTime days')
      .sort({ enrollmentDate: -1 })
      .lean();

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update enrollment
// @route   PUT /api/enrollments/:id
// @access  Private/Admin
const updateEnrollment = async (req, res) => {
  try {
    const {
      status,
      dropDate,
      dropReason,
      suspensionDate,
      suspensionReason,
      notes,
      enrollmentDate,
      startDate,
      expectedEndDate,
      dueDay,
      originalFee,
      finalFee,
      discountReason,
      admissionFee,
      admissionFeeApplied,
    } = req.body;

    const enrollment = await StudentEnrollment.findById(req.params.id).populate('company');
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
    if (!canAccessCompany(req.user, enrollment.company)) return res.status(401).json({ message: 'Not authorized' });

    const before = { ...enrollment.toObject() };

    if (status) {
      enrollment.status = status;
      
      if (status === 'dropped' && dropDate) {
        enrollment.dropDate = dropDate;
        enrollment.dropReason = dropReason;
        enrollment.actualEndDate = dropDate;
      }
      
      if (status === 'suspended' && suspensionDate) {
        enrollment.suspensionDate = suspensionDate;
        enrollment.suspensionReason = suspensionReason;
      }
      
      if (status === 'completed') {
        enrollment.actualEndDate = new Date();
      }
    }

    if (enrollmentDate) enrollment.enrollmentDate = enrollmentDate;
    if (startDate) enrollment.startDate = startDate;
    if (expectedEndDate) enrollment.expectedEndDate = expectedEndDate;
    if (dueDay) enrollment.dueDay = dueDay;
    if (originalFee !== undefined) enrollment.originalFee = originalFee;
    if (finalFee !== undefined) enrollment.finalFee = finalFee;
    if (discountReason !== undefined) enrollment.discountReason = discountReason;
    if (admissionFee !== undefined) enrollment.admissionFee = admissionFee;
    if (admissionFeeApplied !== undefined) enrollment.admissionFeeApplied = admissionFeeApplied;
    if (notes) enrollment.notes = notes;

    const updatedEnrollment = await enrollment.save();
    try { await logAudit({ req, companyId: enrollment.company._id, action: 'update', entityType: 'enrollment', entityId: enrollment._id, before, after: updatedEnrollment }); } catch(_) {}

    await updatedEnrollment.populate(['student', 'course', 'batch']);
    return res.json(updatedEnrollment);
  } catch (error) {
    console.error('[updateEnrollment] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete enrollment
// @route   DELETE /api/enrollments/:id
// @access  Private/Admin
const deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await StudentEnrollment.findById(req.params.id).populate('company');
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
    if (!canAccessCompany(req.user, enrollment.company)) return res.status(401).json({ message: 'Not authorized' });

    try { await logAudit({ req, companyId: enrollment.company._id, action: 'delete', entityType: 'enrollment', entityId: enrollment._id, before: enrollment, after: null }); } catch(_) {}
    await enrollment.deleteOne();
    return res.json({ message: 'Enrollment deleted successfully' });
  } catch (error) {
    console.error('[deleteEnrollment] error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Get enrollment statistics including discounts and admission fees
// @route   GET /api/enrollments/statistics/:companyId
// @access  Private/Admin
const getEnrollmentStatistics = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const baseQuery = { company: companyId };
    if (startDate || endDate) {
      baseQuery.enrollmentDate = dateFilter;
    }

    // Aggregate statistics
    const stats = await StudentEnrollment.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalEnrollments: { $sum: 1 },
          activeEnrollments: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalOriginalFee: { $sum: '$originalFee' },
          totalFinalFee: { $sum: '$finalFee' },
          totalDiscount: { $sum: '$discountAmount' },
          totalAdmissionFee: {
            $sum: {
              $cond: [
                { $and: ['$admissionFeeApplied', { $eq: ['$admissionFeeCharged', false] }] },
                '$admissionFee',
                0
              ]
            }
          },
          avgDiscount: { $avg: '$discountAmount' },
          maxDiscount: { $max: '$discountAmount' },
        }
      }
    ]);

    // Course-wise discount breakdown
    const courseStats = await StudentEnrollment.aggregate([
      { $match: baseQuery },
      {
        $lookup: {
          from: 'courses',
          localField: 'course',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      { $unwind: '$courseInfo' },
      {
        $group: {
          _id: '$course',
          courseName: { $first: '$courseInfo.name' },
          enrollments: { $sum: 1 },
          totalOriginalFee: { $sum: '$originalFee' },
          totalFinalFee: { $sum: '$finalFee' },
          totalDiscount: { $sum: '$discountAmount' },
          avgDiscount: { $avg: '$discountAmount' }
        }
      },
      { $sort: { totalDiscount: -1 } }
    ]);

    // Student-wise discount (top 10)
    const studentStats = await StudentEnrollment.aggregate([
      { $match: baseQuery },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $group: {
          _id: '$student',
          studentName: { $first: '$studentInfo.name' },
          totalEnrollments: { $sum: 1 },
          totalDiscount: { $sum: '$discountAmount' }
        }
      },
      { $sort: { totalDiscount: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      summary: stats[0] || {
        totalEnrollments: 0,
        activeEnrollments: 0,
        totalOriginalFee: 0,
        totalFinalFee: 0,
        totalDiscount: 0,
        totalAdmissionFee: 0,
        avgDiscount: 0,
        maxDiscount: 0
      },
      byCourse: courseStats,
      byStudent: studentStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  createEnrollment,
  getEnrollmentsByCompany,
  getEnrollmentsByStudent,
  updateEnrollment,
  deleteEnrollment,
  getEnrollmentStatistics,
};
