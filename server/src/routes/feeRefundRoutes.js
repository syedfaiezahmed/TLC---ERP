import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { createFeeRefund, getFeeRefunds, getFeeRefundById, deleteFeeRefund } from '../controllers/feeRefundController.js';

const router = express.Router();

router.post('/', protect, admin, createFeeRefund);
router.get('/company/:companyId', protect, admin, getFeeRefunds);
router.get('/:id', protect, admin, getFeeRefundById);
router.delete('/:id', protect, admin, deleteFeeRefund);

export default router;
