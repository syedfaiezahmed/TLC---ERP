import express from 'express';
import badDebtController from '../controllers/badDebtController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin/accountant role
router.use(protect);
router.use(authorize('admin', 'accountant', 'superadmin'));

// Mark single fee as bad debt
router.post('/mark', badDebtController.markAsBadDebt);

// Bulk mark fees as bad debt
router.post('/bulk-mark', badDebtController.bulkMarkAsBadDebt);

// Get bad debts with filters
router.get('/', badDebtController.getBadDebts);

// Get bad debt summary and statistics
router.get('/summary', badDebtController.getBadDebtSummary);

// Generate bad debt report
router.get('/report', badDebtController.getBadDebtReport);

// Get student bad debt history
router.get('/student/:studentId', badDebtController.getStudentBadDebtHistory);

// Get specific bad debt details
router.get('/:badDebtId', badDebtController.getBadDebtDetails);

// Update bad debt details
router.patch('/:badDebtId', badDebtController.updateBadDebt);

// Recover bad debt
router.post('/:badDebtId/recover', badDebtController.recoverBadDebt);

// Reverse bad debt
router.post('/:badDebtId/reverse', badDebtController.reverseBadDebt);

// Delete bad debt
router.delete('/:badDebtId', badDebtController.deleteBadDebt);

export default router;
