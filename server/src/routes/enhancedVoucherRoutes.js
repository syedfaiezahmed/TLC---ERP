import express from 'express';
import enhancedVoucherController from '../controllers/enhancedVoucherController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and company access
router.use(protect);

// Generate vouchers for a specific date
router.post('/generate', authorize('admin', 'accountant', 'superadmin'), enhancedVoucherController.generateVouchers);

// Get vouchers by date
router.get('/date', enhancedVoucherController.getVouchersByDate);

// Get vouchers with filters and pagination
router.get('/', enhancedVoucherController.getVouchersWithFilters);

// Get voucher statistics
router.get('/statistics', enhancedVoucherController.getVoucherStatistics);

// Admin manual repair — force full heal of voucher statuses (bypasses throttle)
router.post('/heal', authorize('admin', 'accountant', 'superadmin'), enhancedVoucherController.forceHeal);

// Get specific voucher details
router.get('/:id', enhancedVoucherController.getVoucherDetails);

// Update voucher status
router.patch('/:id/status', authorize('admin', 'accountant', 'superadmin'), enhancedVoucherController.updateVoucherStatus);

// Print single voucher
router.get('/:id/print', enhancedVoucherController.printVoucher);

// Bulk print vouchers
router.post('/bulk-print', authorize('admin', 'accountant', 'superadmin'), enhancedVoucherController.bulkPrintVouchers);

// Delete voucher
router.delete('/:id', authorize('admin', 'superadmin'), enhancedVoucherController.deleteVoucher);

export default router;
