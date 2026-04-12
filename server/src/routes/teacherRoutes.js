import express from 'express';
import { createTeacher, getTeachers, updateTeacher, deleteTeacher } from '../controllers/teacherController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, createTeacher);
router.route('/company/:companyId').get(protect, admin, getTeachers);
router.route('/:id').put(protect, admin, updateTeacher).delete(protect, admin, deleteTeacher);

export default router;
