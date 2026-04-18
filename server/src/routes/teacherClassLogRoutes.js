import express from 'express';
import {
  getClassLogs,
  saveClassLogs,
  getMonthlySummary,
  generatePayrollFromLogs,
} from '../controllers/teacherClassLogController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/company/:companyId',          protect, admin, getClassLogs);
router.get('/monthly/:companyId',          protect, admin, getMonthlySummary);
router.post('/',                           protect, admin, saveClassLogs);
router.post('/generate-payroll/:companyId', protect, admin, generatePayrollFromLogs);

export default router;
