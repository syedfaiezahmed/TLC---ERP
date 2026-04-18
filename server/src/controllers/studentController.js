import Student from '../models/Student.js';
import Company from '../models/Company.js';

import { canAccessCompany } from '../utils/companyAccess.js';
import { logAudit } from '../services/auditService.js';
import { postJournal } from '../services/journalService.js';

// @desc    Create a new student
// @route   POST /api/students
// @access  Private/Admin
const createStudent = async (req, res) => {
  try {
    const { 
      name, 
      studentId,
      contact, 
      email, 
      dateOfBirth,
      gender,
      address, 
      fatherName,
      motherName,
      guardianInfo, 
      emergencyContact,
      status,
      companyId,
      groupId,
      openingBalance 
    } = req.body;

    // Verify company exists and belongs to user
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized to add student to this company' });

    const student = new Student({
      name,
      studentId,
      contact,
      email,
      dateOfBirth,
      gender,
      address,
      fatherName,
      motherName,
      guardianInfo,
      emergencyContact,
      status,
      company: companyId,
      group: groupId || undefined,
    });

    const createdStudent = await student.save();
    await logAudit({ req, companyId, action: 'create', entityType: 'student', entityId: createdStudent._id, before: null, after: createdStudent });

    // Handle Opening Balance
    if (openingBalance && Number(openingBalance) !== 0) {
        const balance = Number(openingBalance);
        const date = req.body.openingBalanceDate || new Date(); // Use provided date or today
        await postJournal(
          {
            companyId,
            studentId: createdStudent._id,
            date,
            description: 'Opening Balance - Student',
            referenceType: 'opening',
            referenceId: createdStudent._id,
          },
          [
            {
              accountName: 'Accounts Receivable',
              accountType: 'asset',
              debit: balance > 0 ? balance : 0,
              credit: balance < 0 ? Math.abs(balance) : 0,
              relatedAccount: 'Opening Balance Equity',
              type: 'opening',
              student: createdStudent._id,
              description: 'Opening Balance - Accounts Receivable',
            },
            {
              accountName: 'Opening Balance Equity',
              accountType: 'equity',
              debit: balance < 0 ? Math.abs(balance) : 0,
              credit: balance > 0 ? balance : 0,
              relatedAccount: 'Accounts Receivable',
              type: 'opening',
              description: 'Opening Balance - Offset',
            },
          ]
        );
    }

    res.status(201).json(createdStudent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all students for a company
// @route   GET /api/students/company/:companyId
// @access  Private/Admin
const getStudents = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page, limit, search } = req.query;

    // Verify company
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized to view students of this company' });

    let query = { company: companyId };

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { contact: { $regex: search, $options: 'i' } }
        ];
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20; // Default limit
    const skip = (pageNum - 1) * limitNum;

    // Run count and data fetch in parallel
    const [students, total] = await Promise.all([
        Student.find(query)
            .populate('group', 'name code color level')
            .sort({ name: 1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Student.countDocuments(query)
    ]);

    res.json({
        students,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get student by ID
// @route   GET /api/students/:id
// @access  Private/Admin
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('company').populate('group', 'name code color level');

    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!canAccessCompany(req.user, student.company)) return res.status(401).json({ message: 'Not authorized to view this student' });
    return res.json(student);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ message: error.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
  try {
    const { 
      name, 
      studentId,
      contact, 
      email, 
      dateOfBirth,
      gender,
      address, 
      fatherName,
      motherName,
      guardianInfo, 
      emergencyContact,
      status,
      groupId
    } = req.body;

    const student = await Student.findById(req.params.id).populate('company');

    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!canAccessCompany(req.user, student.company)) return res.status(401).json({ message: 'Not authorized to update this student' });

    const before = student.toObject();
    student.name = name || student.name;
    student.studentId = studentId || student.studentId;
    student.contact = contact || student.contact;
    student.email = email || student.email;
    student.dateOfBirth = dateOfBirth || student.dateOfBirth;
    student.gender = gender || student.gender;
    student.address = address || student.address;
    student.fatherName = fatherName || student.fatherName;
    student.motherName = motherName || student.motherName;
    student.guardianInfo = guardianInfo || student.guardianInfo;
    student.emergencyContact = emergencyContact || student.emergencyContact;
    student.status = status || student.status;
    if (groupId !== undefined) student.group = groupId || undefined;

    const updatedStudent = await student.save();
    try { await logAudit({ req, companyId: student.company._id, action: 'update', entityType: 'student', entityId: student._id, before, after: updatedStudent }); } catch(_) {}
    return res.json(updatedStudent);
  } catch (error) {
    console.error('updateStudent error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('company');

    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!canAccessCompany(req.user, student.company)) return res.status(401).json({ message: 'Not authorized to delete this student' });

    const before = student.toObject();
    await student.deleteOne();
    try { await logAudit({ req, companyId: student.company._id, action: 'delete', entityType: 'student', entityId: before._id, before, after: null }); } catch(_) {}
    return res.json({ message: 'Student removed' });
  } catch (error) {
    console.error('deleteStudent error:', error.message);
    if (!res.headersSent) return res.status(400).json({ message: error.message });
  }
};

export {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
};
