import express from 'express';
import { createCategory, getCategories, deleteCategory } from '../controllers/expenseCategoryController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, createCategory);
router.route('/company/:companyId').get(protect, admin, getCategories);
router.route('/:id').delete(protect, admin, deleteCategory);

export default router;
