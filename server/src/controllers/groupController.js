import Group from '../models/Group.js';
import Course from '../models/Course.js';
import Student from '../models/Student.js';
import mongoose from 'mongoose';

const resolveCompanyId = (req) =>
  req.params.companyId || req.body.companyId || req.query.companyId || req.user?.company;

// @desc   List all groups for a company (with counts of courses + students)
// @route  GET /api/groups/company/:companyId
export const listGroups = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

    const companyObjId = new mongoose.Types.ObjectId(companyId);

    const groups = await Group.aggregate([
      { $match: { company: companyObjId } },
      {
        $lookup: {
          from: 'courses',
          let: { gid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$group', '$$gid'] } } }, { $count: 'n' }],
          as: 'courseAgg',
        },
      },
      {
        $lookup: {
          from: 'students',
          let: { gid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$group', '$$gid'] } } }, { $count: 'n' }],
          as: 'studentAgg',
        },
      },
      {
        $addFields: {
          courseCount: { $ifNull: [{ $arrayElemAt: ['$courseAgg.n', 0] }, 0] },
          studentCount: { $ifNull: [{ $arrayElemAt: ['$studentAgg.n', 0] }, 0] },
        },
      },
      { $project: { courseAgg: 0, studentAgg: 0 } },
      { $sort: { displayOrder: 1, name: 1 } },
    ]);

    res.json({ groups, total: groups.length });
  } catch (err) {
    console.error('Error listing groups:', err);
    res.status(500).json({ message: 'Failed to list groups', error: err.message });
  }
};

// @desc   Get a single group
// @route  GET /api/groups/:id
export const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    console.error('Error fetching group:', err);
    res.status(500).json({ message: 'Failed to fetch group', error: err.message });
  }
};

// @desc   Create a group
// @route  POST /api/groups
export const createGroup = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

    const { name, code, level, description, subjects, color, displayOrder, status } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const payload = {
      company: companyId,
      name: name.trim(),
      code: code?.trim()?.toUpperCase() || undefined,
      level: level || 'Intermediate',
      description: description?.trim() || undefined,
      subjects: Array.isArray(subjects) ? subjects.map((s) => String(s).trim()).filter(Boolean) : [],
      color: color || '#1976d2',
      displayOrder: Number(displayOrder) || 0,
      status: status || 'active',
    };

    const group = await Group.create(payload);
    res.status(201).json(group);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A group with this name or code already exists.' });
    }
    console.error('Error creating group:', err);
    res.status(500).json({ message: 'Failed to create group', error: err.message });
  }
};

// @desc   Update a group
// @route  PUT /api/groups/:id
export const updateGroup = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.name) updates.name = updates.name.trim();
    if (updates.code !== undefined) {
      const c = String(updates.code).trim().toUpperCase();
      updates.code = c || undefined;
    }
    if (Array.isArray(updates.subjects)) {
      updates.subjects = updates.subjects.map((s) => String(s).trim()).filter(Boolean);
    }

    const group = await Group.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A group with this name or code already exists.' });
    }
    console.error('Error updating group:', err);
    res.status(500).json({ message: 'Failed to update group', error: err.message });
  }
};

// @desc   Delete a group (soft unlinks courses/students)
// @route  DELETE /api/groups/:id
export const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Unlink from courses and students before deletion (preserve referential integrity).
    await Promise.all([
      Course.updateMany({ group: group._id }, { $unset: { group: 1 } }),
      Student.updateMany({ group: group._id }, { $unset: { group: 1 } }),
    ]);

    await group.deleteOne();
    res.json({ message: 'Group deleted and unlinked from courses/students', id: group._id });
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).json({ message: 'Failed to delete group', error: err.message });
  }
};

// @desc   Seed standard Pakistani academic groups for a company
// @route  POST /api/groups/seed-defaults/:companyId
export const seedDefaultGroups = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ message: 'Company ID is required' });

    const DEFAULTS = [
      {
        name: 'Pre-Engineering',
        code: 'PRE-ENG',
        level: 'Intermediate',
        description: 'Physics, Chemistry, Mathematics (FSc Pre-Engineering)',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'English', 'Urdu', 'Islamiat/Pak Studies'],
        color: '#1976d2',
        displayOrder: 1,
      },
      {
        name: 'Pre-Medical',
        code: 'PRE-MED',
        level: 'Intermediate',
        description: 'Physics, Chemistry, Biology (FSc Pre-Medical)',
        subjects: ['Physics', 'Chemistry', 'Biology', 'English', 'Urdu', 'Islamiat/Pak Studies'],
        color: '#2e7d32',
        displayOrder: 2,
      },
      {
        name: 'Computer Science',
        code: 'ICS',
        level: 'Intermediate',
        description: 'ICS — Physics/Statistics, Mathematics, Computer Science',
        subjects: ['Computer Science', 'Mathematics', 'Physics/Statistics', 'English', 'Urdu', 'Islamiat/Pak Studies'],
        color: '#6a1b9a',
        displayOrder: 3,
      },
      {
        name: 'Commerce',
        code: 'COMM',
        level: 'Intermediate',
        description: 'I.Com / B.Com — Accounting, Economics, Business',
        subjects: ['Principles of Accounting', 'Business Maths', 'Economics', 'Commerce', 'English', 'Urdu'],
        color: '#ef6c00',
        displayOrder: 4,
      },
      {
        name: 'Arts / Humanities',
        code: 'ARTS',
        level: 'Intermediate',
        description: 'F.A — Languages, Social Sciences, Humanities',
        subjects: ['Urdu Adab', 'English', 'Civics', 'Education', 'Islamiat', 'Pak Studies'],
        color: '#c2185b',
        displayOrder: 5,
      },
      {
        name: 'Matric Science',
        code: 'MATRIC-SCI',
        level: 'Matric',
        description: 'Class IX-X Science Group',
        subjects: ['Physics', 'Chemistry', 'Biology/Computer', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'Pak Studies'],
        color: '#00838f',
        displayOrder: 6,
      },
      {
        name: 'Matric General',
        code: 'MATRIC-GEN',
        level: 'Matric',
        description: 'Class IX-X General / Arts Group',
        subjects: ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'Pak Studies'],
        color: '#5d4037',
        displayOrder: 7,
      },
    ];

    const existing = await Group.find({ company: companyId }, { name: 1, code: 1 }).lean();
    const haveNames = new Set(existing.map((g) => g.name.toLowerCase()));
    const haveCodes = new Set(existing.map((g) => (g.code || '').toUpperCase()).filter(Boolean));

    const toInsert = DEFAULTS.filter(
      (g) => !haveNames.has(g.name.toLowerCase()) && !haveCodes.has(g.code.toUpperCase())
    ).map((g) => ({ ...g, company: companyId, status: 'active' }));

    const created = toInsert.length ? await Group.insertMany(toInsert) : [];

    res.json({
      message: `Seeded ${created.length} default group(s). ${existing.length} already existed.`,
      created,
      skipped: DEFAULTS.length - created.length,
    });
  } catch (err) {
    console.error('Error seeding default groups:', err);
    res.status(500).json({ message: 'Failed to seed default groups', error: err.message });
  }
};
