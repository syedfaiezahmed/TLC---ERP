import express from 'express';
import { createTeacher, getTeachers, updateTeacher, deleteTeacher, deleteTeacherByInfo } from '../controllers/teacherController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, createTeacher);
router.route('/company/:companyId').get(protect, admin, getTeachers);
router.route('/:id').put(protect, admin, updateTeacher).delete(protect, admin, deleteTeacher);
router.delete('/deleteByInfo', protect, admin, deleteTeacherByInfo);

export default router;
