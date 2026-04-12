import express from 'express';
import { createPurchase, getPurchases, getPurchaseById, updatePurchase, deletePurchase, recordPayment, deletePaymentEntry } from '../controllers/purchaseController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, createPurchase);
router.route('/company/:companyId').get(protect, admin, getPurchases);
router.route('/:id').get(protect, admin, getPurchaseById).put(protect, admin, updatePurchase).delete(protect, admin, deletePurchase);
router.route('/:id/pay').post(protect, admin, recordPayment);
router.route('/:id/pay/:paymentId').delete(protect, admin, deletePaymentEntry);

export default router;
