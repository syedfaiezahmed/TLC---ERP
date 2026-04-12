import express from 'express';
import {
  createEnrollment,
  getEnrollmentsByCompany,
  getEnrollmentsByStudent,
  updateEnrollment,
  deleteEnrollment,
  getEnrollmentStatistics,
} from '../controllers/enrollmentController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, createEnrollment);
router.route('/company/:companyId').get(protect, getEnrollmentsByCompany);
router.route('/student/:studentId').get(protect, getEnrollmentsByStudent);
router.route('/statistics/:companyId').get(protect, admin, getEnrollmentStatistics);
router.route('/:id').put(protect, admin, updateEnrollment).delete(protect, admin, deleteEnrollment);

export default router;
