import express from 'express';
const router = express.Router();
import {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchStudents,
} from '../controllers/batchController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/')
  .get(protect, getBatches)
  .post(protect, createBatch);

router.get('/:id/students', protect, getBatchStudents);

router.route('/:id')
  .get(protect, getBatchById)
  .put(protect, updateBatch)
  .delete(protect, deleteBatch);

export default router;
