import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { createPurchaseReturn, getPurchaseReturns, getPurchaseReturnById, deletePurchaseReturn } from '../controllers/purchaseReturnController.js';

const router = express.Router();

router.post('/', protect, admin, createPurchaseReturn);
router.get('/company/:companyId', protect, admin, getPurchaseReturns);
router.get('/:id', protect, admin, getPurchaseReturnById);
router.delete('/:id', protect, admin, deletePurchaseReturn);

export default router;
