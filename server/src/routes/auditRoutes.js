import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getAuditLogs } from '../controllers/auditController.js';

const router = express.Router();

router.get('/company/:companyId', protect, admin, getAuditLogs);

export default router;

