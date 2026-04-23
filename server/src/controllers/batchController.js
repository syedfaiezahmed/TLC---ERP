import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Student from '../models/Student.js';
import StudentEnrollment from '../models/StudentEnrollment.js';

// @desc    Get all batches for a company
// @route   GET /api/batches
// @access  Private
const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find({ company: req.user.company })
      .populate('course', 'name')
      .populate('students', 'name studentId')
      .sort({ createdAt: -1 });
    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single batch
// @route   GET /api/batches/:id
// @access  Private
const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findOne({ 
      _id: req.params.id, 
      company: req.user.company 
    })
    .populate('course', 'name')
    .populate('students', 'name studentId email contact');

    if (batch) {
      res.json(batch);
    } else {
      res.status(404).json({ message: 'Batch not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a batch
// @route   POST /api/batches
// @access  Private
const createBatch = async (req, res) => {
  try {
    const { name, course, startTime, endTime, days, students } = req.body;

    const batch = new Batch({
      company: req.user.company,
      name,
      course,
      startTime,
      endTime,
      days,
      students
    });

    const createdBatch = await batch.save();
    res.status(201).json(createdBatch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a batch
// @route   PUT /api/batches/:id
// @access  Private
const updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findOne({ 
      _id: req.params.id, 
      company: req.user.company 
    });

    if (batch) {
      batch.name = req.body.name || batch.name;
      batch.course = req.body.course || batch.course;
      batch.startTime = req.body.startTime || batch.startTime;
      batch.endTime = req.body.endTime || batch.endTime;
      batch.days = req.body.days || batch.days;
      batch.students = req.body.students || batch.students;
      batch.status = req.body.status || batch.status;

      const updatedBatch = await batch.save();
      res.json(updatedBatch);
    } else {
      res.status(404).json({ message: 'Batch not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a batch
// @route   DELETE /api/batches/:id
// @access  Private
const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findOne({ 
      _id: req.params.id, 
      company: req.user.company 
    });

    if (batch) {
      await batch.deleteOne();
      res.json({ message: 'Batch removed' });
    } else {
      res.status(404).json({ message: 'Batch not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get actively enrolled students for a batch (from StudentEnrollment)
// @route   GET /api/batches/:id/students
// @access  Private
const getBatchStudents = async (req, res) => {
  try {
    const enrollments = await StudentEnrollment.find({
      batch: req.params.id,
      company: req.user.company,
      status: 'active',
    })
      .populate('student', 'name studentId email contact')
      .lean();

    const students = enrollments.map(e => e.student).filter(Boolean);
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchStudents,
};
