import express from 'express';
import { 
    getFeeCollectionReport,
    getPendingFeesReport,
    getStudentLedgerReport,
    getSummaryReport,
    getVoucherReport
} from '../controllers/feeReportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Comprehensive Fee Reports - Production Ready
router.get('/fee-collection/:companyId', authorize('admin', 'accountant', 'superadmin'), getFeeCollectionReport);
router.get('/pending-fees/:companyId', authorize('admin', 'accountant', 'superadmin'), getPendingFeesReport);
router.get('/student-ledger/:companyId/:studentId', authorize('admin', 'accountant', 'superadmin'), getStudentLedgerReport);
router.get('/summary/:companyId', authorize('admin', 'accountant', 'superadmin'), getSummaryReport);
router.get('/vouchers/:companyId', authorize('admin', 'accountant', 'superadmin'), getVoucherReport);

// Legacy routes (maintained for backward compatibility)
// router.post('/generate/student-fee', feeReportController.generateStudentFeeReport);
// router.post('/generate/cash-flow', feeReportController.generateCashFlowReport);
// router.post('/generate/class-wise', feeReportController.generateClassWiseReport);
// router.post('/generate/teacher-commission', feeReportController.generateTeacherCommissionReport);

// Get saved reports
// router.get('/', feeReportController.getSavedReports);

// Get specific report
// router.get('/:reportId', feeReportController.getReportById);

// Export report
// router.get('/:reportId/export', feeReportController.exportReport);

// Delete report
// router.delete('/:reportId', authorize('admin', 'accountant'), feeReportController.deleteReport);

// Get report summary
// router.get('/summary/overview', feeReportController.getReportSummary);

// Schedule report (admin/accountant only)
// router.post('/schedule', authorize('admin', 'accountant'), feeReportController.scheduleReport);

// Get dashboard statistics
// router.get('/dashboard/stats', feeReportController.getDashboardStats);

export default router;
