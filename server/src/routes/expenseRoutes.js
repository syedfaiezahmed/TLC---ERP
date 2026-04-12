import express from 'express';
import { createExpense, getExpenses, deleteExpense } from '../controllers/expenseController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, createExpense);
router.route('/company/:companyId').get(protect, admin, getExpenses);
router.route('/:id').delete(protect, admin, deleteExpense);

export default router;
