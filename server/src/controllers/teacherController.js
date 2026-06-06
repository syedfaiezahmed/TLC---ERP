import Teacher from '../models/Teacher.js';
import Company from '../models/Company.js';
import Course from '../models/Course.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import { logAudit } from '../services/auditService.js';
import { postJournal } from '../services/journalService.js';

// @desc    Create a new teacher
// @route   POST /api/teachers
// @access  Private/Admin
const createTeacher = async (req, res) => {
  try {
    const {
      name, contact, email, address, specialization, companyId, openingBalance, openingBalanceDate,
      salaryType, annualSalary, fixedSalary, assignedCourses, perClassRates, commissionRates, bankDetails,
    } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const annual = Number(annualSalary || 0);
    const monthly = annual > 0 ? annual / 12 : Number(fixedSalary || 0);

    const teacher = new Teacher({
      name,
      contact,
      email,
      address,
      specialization,
      company: companyId,
      salaryType: salaryType || 'fixed',
      annualSalary: annual,
      fixedSalary: monthly,
      assignedCourses: (assignedCourses || []).filter(r => r.course),
      perClassRates: (perClassRates || []).filter(r => r.course),
      commissionRates: (commissionRates || []).filter(r => r.course),
      bankDetails: bankDetails || {},
    });

    const createdTeacher = await teacher.save();
    try { await logAudit({ req, companyId, action: 'create', entityType: 'teacher', entityId: createdTeacher._id, before: null, after: createdTeacher }); } catch(_) {}

    // Handle Opening Balance (e.g., if there are pending payments to teacher)
    if (openingBalance && Number(openingBalance) !== 0) {
        const balance = Number(openingBalance);
        const date = req.body.openingBalanceDate || new Date();
        await postJournal(
          {
            companyId,
            teacherId: createdTeacher._id,
            date,
            description: 'Opening Balance - Teacher',
            referenceType: 'opening',
            referenceId: createdTeacher._id,
          },
          [
            {
              accountName: 'Accounts Payable',
              accountType: 'liability',
              debit: balance < 0 ? Math.abs(balance) : 0,
              credit: balance > 0 ? balance : 0,
              relatedAccount: 'Opening Balance Equity',
              type: 'opening',
              teacher: createdTeacher._id,
              description: 'Opening Balance - Accounts Payable',
            },
            {
              accountName: 'Opening Balance Equity',
              accountType: 'equity',
              debit: balance > 0 ? balance : 0,
              credit: balance < 0 ? Math.abs(balance) : 0,
              relatedAccount: 'Accounts Payable',
              type: 'opening',
              description: 'Opening Balance - Offset',
            },
          ]
        );
    }

    res.status(201).json(createdTeacher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all teachers for a company
// @route   GET /api/teachers/company/:companyId
// @access  Private/Admin
const getTeachers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page, limit, search } = req.query;

    let query = { company: companyId };

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { contact: { $regex: search, $options: 'i' } }
        ];
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [teachers, total] = await Promise.all([
        Teacher.find(query)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limitNum)
            .populate('perClassRates.course', 'name')
            .populate('perClassRates.batch', 'name course')
            .populate('assignedCourses.course', 'name')
            .populate('assignedCourses.batch', 'name course')
            .lean(),
        Teacher.countDocuments(query)
    ]);

    res.json({
        teachers,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private/Admin
const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    const company = await Company.findById(teacher.company);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    teacher.name = req.body.name || teacher.name;
    teacher.contact = req.body.contact || teacher.contact;
    teacher.email = req.body.email !== undefined ? req.body.email : teacher.email;
    teacher.address = req.body.address !== undefined ? req.body.address : teacher.address;
    teacher.specialization = req.body.specialization !== undefined ? req.body.specialization : teacher.specialization;
    if (req.body.salaryType !== undefined) teacher.salaryType = req.body.salaryType;
    if (req.body.annualSalary !== undefined) {
      teacher.annualSalary = Number(req.body.annualSalary);
      teacher.fixedSalary = teacher.annualSalary > 0 ? teacher.annualSalary / 12 : (Number(req.body.fixedSalary || 0));
    } else if (req.body.fixedSalary !== undefined) {
      teacher.fixedSalary = Number(req.body.fixedSalary);
    }
    if (req.body.assignedCourses !== undefined) teacher.assignedCourses = req.body.assignedCourses.filter(r => r.course);
    if (req.body.perClassRates !== undefined) teacher.perClassRates = req.body.perClassRates.filter(r => r.course);
    if (req.body.commissionRates !== undefined) teacher.commissionRates = req.body.commissionRates.filter(r => r.course);
    if (req.body.bankDetails !== undefined) teacher.bankDetails = req.body.bankDetails;

    const updatedTeacher = await teacher.save();
    try { await logAudit({ req, companyId: teacher.company, action: 'update', entityType: 'teacher', entityId: teacher._id, before: null, after: updatedTeacher }); } catch(_) {}
    return res.json(updatedTeacher);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private/Admin
const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    const company = await Company.findById(teacher.company);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    // Force delete: ignore any course assignments
    // Previously we prevented deletion if the teacher was assigned to courses.
    // This check is removed to allow deletion at any cost.


    await teacher.deleteOne();
    try { await logAudit({ req, companyId: teacher.company, action: 'delete', entityType: 'teacher', entityId: teacher._id, before: teacher.toObject(), after: null }); } catch(_) {}
    return res.json({ message: 'Teacher removed' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete teacher by name and contact (admin only)
// @route   DELETE /api/teachers/deleteByInfo?name=...&contact=...
// @access  Private/Admin
const deleteTeacherByInfo = async (req, res) => {
  try {
    const { name, contact } = req.query;
    if (!name || !contact) {
      return res.status(400).json({ message: 'Name and contact query parameters are required' });
    }
    const teacher = await Teacher.findOne({ name, contact });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    const company = await Company.findById(teacher.company);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });
    const coursesCount = await Course.countDocuments({ teacher: teacher._id });
    if (coursesCount > 0) return res.status(400).json({ message: 'Cannot delete teacher assigned to courses' });
    await teacher.deleteOne();
    try { await logAudit({ req, companyId: teacher.company, action: 'delete', entityType: 'teacher', entityId: teacher._id, before: teacher.toObject(), after: null }); } catch (_) {}
    return res.json({ message: 'Teacher removed by info' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export { createTeacher, getTeachers, updateTeacher, deleteTeacher, deleteTeacherByInfo };
