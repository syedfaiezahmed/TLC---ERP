import express from 'express';
const router = express.Router();
import {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} from '../controllers/batchController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/')
  .get(protect, getBatches)
  .post(protect, createBatch);

router.route('/:id')
  .get(protect, getBatchById)
  .put(protect, updateBatch)
  .delete(protect, deleteBatch);

export default router;
