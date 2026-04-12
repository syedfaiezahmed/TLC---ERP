import express from 'express';
import {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, createStudent);
router.route('/company/:companyId').get(protect, admin, getStudents);
router
  .route('/:id')
  .get(protect, admin, getStudentById)
  .put(protect, admin, updateStudent)
  .delete(protect, admin, deleteStudent);

export default router;
