import express from 'express';
import {
  generateVeeVoucher,
  getVouchersByCompany,
  getVoucherById,
  recordVoucherPayment,
  cancelVoucher,
  getOverdueVouchers,
} from '../controllers/voucherController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/generate').post(protect, admin, generateVeeVoucher);
router.route('/company/:companyId').get(protect, getVouchersByCompany);
router.route('/company/:companyId/overdue').get(protect, getOverdueVouchers);
router.route('/:id').get(protect, getVoucherById);
router.route('/:id/payment').post(protect, admin, recordVoucherPayment);
router.route('/:id/cancel').put(protect, admin, cancelVoucher);

export default router;
