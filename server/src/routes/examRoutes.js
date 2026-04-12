import express from 'express';
const router = express.Router();
import {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  saveExamResults,
} from '../controllers/examController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/')
  .get(protect, getExams)
  .post(protect, createExam);

router.route('/:id')
  .get(protect, getExamById)
  .put(protect, updateExam)
  .delete(protect, deleteExam);

router.route('/:id/results')
  .post(protect, saveExamResults);

export default router;
