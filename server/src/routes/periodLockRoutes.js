import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getPeriodLock, setPeriodLock, clearPeriodLock } from '../controllers/periodLockController.js';

const router = express.Router();

router.route('/:companyId').get(protect, admin, getPeriodLock).put(protect, admin, setPeriodLock).delete(protect, admin, clearPeriodLock);

export default router;

