import Course from '../models/Course.js';
import Company from '../models/Company.js';
import Ledger from '../models/Ledger.js';
import { canAccessCompany } from '../utils/companyAccess.js';
import { logAudit } from '../services/auditService.js';

// @desc    Get all courses for a company
// @route   GET /api/courses/company/:companyId
// @access  Private/Admin
const getCourses = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page, limit, search } = req.query;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    let query = { company: companyId };
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [courses, total] = await Promise.all([
        Course.find(query)
          .select('name code fee duration type teacher group description')
          .populate('teacher', 'name')
          .populate('group', 'name code color level')
          .sort({ name: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Course.countDocuments(query)
    ]);

    res.json({
        courses,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a course
// @route   POST /api/courses
// @access  Private/Admin
const createCourse = async (req, res) => {
  try {
    const { companyId, name, type, description, fee, code, duration, teacherId, groupId } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!canAccessCompany(req.user, company)) return res.status(401).json({ message: 'Not authorized' });

    const course = new Course({
      company: companyId,
      name,
      type: type || 'course',
      description,
      fee,
      code,
      duration,
      teacher: teacherId || undefined,
      group: groupId || undefined,
    });

    const createdCourse = await course.save();
    try { await logAudit({ req, companyId, action: 'create', entityType: 'course', entityId: createdCourse._id, before: null, after: createdCourse }); } catch(_) {}
    return res.status(201).json(createdCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a course
// @route   PUT /api/courses/:id
// @access  Private/Admin
const updateCourse = async (req, res) => {
  try {
    const { name, type, description, fee, code, duration, teacherId, groupId } = req.body;
    const course = await Course.findById(req.params.id).populate('company');

    if (!course) return res.status(404).json({ message: 'Course not found' });
    if (!canAccessCompany(req.user, course.company)) return res.status(401).json({ message: 'Not authorized' });

    const before = course.toObject();
    course.name = name || course.name;
    course.type = type || course.type;
    course.description = description || course.description;
    if (fee !== undefined) course.fee = fee;
    course.code = code || course.code;
    course.duration = duration || course.duration;
    if (teacherId !== undefined) course.teacher = teacherId || undefined;
    if (groupId !== undefined) course.group = groupId || undefined;

    const updatedCourse = await course.save();
    try { await logAudit({ req, companyId: course.company._id, action: 'update', entityType: 'course', entityId: course._id, before, after: updatedCourse }); } catch(_) {}
    return res.json(updatedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a course
// @route   DELETE /api/courses/:id
// @access  Private/Admin
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('company');

    if (!course) return res.status(404).json({ message: 'Course not found' });
    if (!canAccessCompany(req.user, course.company)) return res.status(401).json({ message: 'Not authorized' });

    const before = course.toObject();
    await course.deleteOne();
    try { await logAudit({ req, companyId: course.company._id, action: 'delete', entityType: 'course', entityId: before._id, before, after: null }); } catch(_) {}
    return res.json({ message: 'Course removed' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export { getCourses, createCourse, updateCourse, deleteCourse };
