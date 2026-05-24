import express from 'express';
const router = express.Router();
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  generateUserQR,
  processScan,
  getTodayScans,
  getScanHistory,
  getQRSettings,
  updateQRSettings,
  getQRUsers,
  deleteScan,
  getDailySummary,
} from '../controllers/qrAttendanceController.js';

// QR generation & user list
router.get('/users/:companyId',            protect, getQRUsers);
router.get('/generate/:userType/:userId',  protect, generateUserQR);

// Scanning
router.post('/scan',                       protect, processScan);

// Records
router.get('/today/:companyId',            protect, getTodayScans);
router.get('/history/:companyId',          protect, getScanHistory);
router.get('/summary/:companyId',          protect, getDailySummary);
router.delete('/scan/:id',                 protect, authorize('admin', 'superadmin'), deleteScan);

// Settings
router.get('/settings/:companyId',         protect, getQRSettings);
router.put('/settings/:companyId',         protect, authorize('admin', 'superadmin'), updateQRSettings);

export default router;
