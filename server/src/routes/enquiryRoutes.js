import express from 'express';
const router = express.Router();
import {
  getEnquiries,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
} from '../controllers/enquiryController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/')
  .get(protect, getEnquiries)
  .post(protect, createEnquiry);

router.route('/:id')
  .put(protect, updateEnquiry)
  .delete(protect, deleteEnquiry);

export default router;
