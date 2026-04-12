import express from 'express';
import {
  createFee,
  getFees,
  getFeeById,
  updateFee,
  deleteFee,
  recordPayment,
  recordGenericPayment,
  deletePayment,
  getPaymentDetails,
} from '../controllers/feeController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, authorize('admin', 'accountant', 'superadmin'), createFee);
router.route('/company/:companyId').get(protect, authorize('admin', 'accountant', 'superadmin'), getFees);
router.route('/student/:studentId/payment').post(protect, authorize('admin', 'accountant', 'superadmin'), recordGenericPayment);
router.route('/payment/:paymentId').delete(protect, authorize('admin', 'accountant', 'superadmin'), deletePayment);
router.route('/:id/payment').post(protect, authorize('admin', 'accountant', 'superadmin'), recordPayment);
router.route('/:feeId/payment/:paymentId').get(protect, authorize('admin', 'accountant', 'superadmin'), getPaymentDetails);

router
  .route('/:id')
  .get(protect, authorize('admin', 'accountant', 'superadmin'), getFeeById)
  .put(protect, authorize('admin', 'accountant', 'superadmin'), updateFee)
  .delete(protect, authorize('admin', 'superadmin'), deleteFee);

export default router;
