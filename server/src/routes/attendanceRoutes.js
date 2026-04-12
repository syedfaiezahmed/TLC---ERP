import express from 'express';
const router = express.Router();
import {
  getAttendance,
  markAttendanceBulk,
  deleteAttendance,
  getMonthlyRegister,
  getAttendanceReport,
  getAttendanceStats,
} from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

router.get('/',               protect, getAttendance);
router.post('/bulk',          protect, markAttendanceBulk);
router.delete('/:id',         protect, authorize('admin', 'superadmin'), deleteAttendance);
router.get('/monthly-register', protect, getMonthlyRegister);
router.get('/report',         protect, getAttendanceReport);
router.get('/stats',          protect, getAttendanceStats);

export default router;
