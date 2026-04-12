import express from 'express';
import pdfVoucherController from '../controllers/pdfVoucherController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Generate single voucher PDF
router.get('/voucher/:voucherId', pdfVoucherController.generateVoucherPDF);

// Preview voucher HTML
router.get('/voucher/:voucherId/preview', pdfVoucherController.previewVoucherPDF);

// Download voucher PDF
router.get('/voucher/:voucherId/download', pdfVoucherController.downloadVoucherPDF);

// Email voucher PDF
router.post('/voucher/:voucherId/email', pdfVoucherController.emailVoucherPDF);

// Generate bulk voucher PDFs
router.post('/bulk', authorize('admin', 'accountant', 'superadmin'), pdfVoucherController.generateBulkVoucherPDF);

// Get print settings
router.get('/settings', pdfVoucherController.getVoucherPrintSettings);

// Update print settings
router.put('/settings', authorize('admin', 'superadmin'), pdfVoucherController.updatePrintSettings);

// Get generated PDFs list
router.get('/generated', pdfVoucherController.getGeneratedPDFs);

// Delete generated PDF
router.delete('/generated/:filename', authorize('admin', 'accountant', 'superadmin'), pdfVoucherController.deleteGeneratedPDF);

export default router;
