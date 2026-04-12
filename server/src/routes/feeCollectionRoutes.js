import express from 'express';
import feeCollectionController from '../controllers/feeCollectionController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Collect fee payment
router.post('/collect', authorize('admin', 'accountant', 'superadmin'), feeCollectionController.collectFee);

// Validate payment before collection
router.post('/validate', feeCollectionController.validatePayment);

// Get payment history with filters
router.get('/history', feeCollectionController.getPaymentHistory);

// Get collection statistics
router.get('/statistics', feeCollectionController.getCollectionStatistics);

// Get daily collection summary
router.get('/daily-summary', feeCollectionController.getDailyCollectionSummary);

// Get monthly collection summary
router.get('/monthly-summary', feeCollectionController.getMonthlyCollectionSummary);

// Get specific payment details
router.get('/payment/:paymentId', feeCollectionController.getPaymentDetails);

// Update payment details
router.patch('/payment/:paymentId', authorize('admin', 'accountant', 'superadmin'), feeCollectionController.updatePayment);

// Delete payment (reverses journal)
router.delete('/payment/:paymentId', authorize('admin', 'superadmin'), feeCollectionController.deletePayment);

// Refund payment
router.post('/payment/:paymentId/refund', authorize('admin', 'accountant', 'superadmin'), feeCollectionController.refundPayment);

// Get student payment history
router.get('/student/:studentId', feeCollectionController.getStudentPaymentHistory);

// Sync / backfill journal entries for existing payments
router.post('/sync-journals', authorize('admin', 'superadmin'), feeCollectionController.syncJournals);

export default router;
