import Exam from '../models/Exam.js';
import Result from '../models/Result.js';

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private
const getExams = async (req, res) => {
  try {
    const exams = await Exam.find({ company: req.user.company })
      .populate('course', 'name')
      .populate('batch', 'name')
      .sort({ date: -1 });
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single exam with results
// @route   GET /api/exams/:id
// @access  Private
const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, company: req.user.company })
      .populate('course', 'name')
      .populate('batch', 'name');

    if (exam) {
      const results = await Result.find({ exam: req.params.id, company: req.user.company })
        .populate('student', 'name studentId email contact');
      res.json({ exam, results });
    } else {
      res.status(404).json({ message: 'Exam not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create an exam
// @route   POST /api/exams
// @access  Private
const createExam = async (req, res) => {
  try {
    const { title, date, course, batch, totalMarks, passingMarks, remarks } = req.body;

    const exam = new Exam({
      company: req.user.company,
      title,
      date,
      course,
      batch,
      totalMarks,
      passingMarks,
      remarks
    });

    const createdExam = await exam.save();
    res.status(201).json(createdExam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update an exam
// @route   PUT /api/exams/:id
// @access  Private
const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, company: req.user.company });

    if (exam) {
      exam.title = req.body.title || exam.title;
      exam.date = req.body.date || exam.date;
      exam.course = req.body.course || exam.course;
      exam.batch = req.body.batch || exam.batch;
      exam.totalMarks = req.body.totalMarks || exam.totalMarks;
      exam.passingMarks = req.body.passingMarks || exam.passingMarks;
      exam.status = req.body.status || exam.status;
      exam.remarks = req.body.remarks || exam.remarks;

      const updatedExam = await exam.save();
      res.json(updatedExam);
    } else {
      res.status(404).json({ message: 'Exam not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete an exam
// @route   DELETE /api/exams/:id
// @access  Private
const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, company: req.user.company });

    if (exam) {
      // Delete associated results first
      await Result.deleteMany({ exam: req.params.id, company: req.user.company });
      await exam.deleteOne();
      res.json({ message: 'Exam and results removed' });
    } else {
      res.status(404).json({ message: 'Exam not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save/Update results for an exam (bulk)
// @route   POST /api/exams/:id/results
// @access  Private
const saveExamResults = async (req, res) => {
  try {
    const { results } = req.body; // Array of { student, marksObtained, status, remarks }

    const exam = await Exam.findOne({ _id: req.params.id, company: req.user.company });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const ops = results.map(result => ({
      updateOne: {
        filter: { 
          company: req.user.company, 
          exam: req.params.id, 
          student: result.student 
        },
        update: { 
          $set: { 
            marksObtained: result.marksObtained, 
            status: result.status, 
            remarks: result.remarks 
          } 
        },
        upsert: true
      }
    }));

    await Result.bulkWrite(ops);
    res.json({ message: 'Results saved successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  saveExamResults
};
