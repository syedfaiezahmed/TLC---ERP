import express from 'express';
import { exportBackup, restoreBackup, getBackupHistory, upload } from '../controllers/backupController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/export', protect, admin, exportBackup);
router.post('/restore', protect, admin, upload.single('backup'), restoreBackup);
router.get('/history/:companyId', protect, admin, getBackupHistory);

export default router;
