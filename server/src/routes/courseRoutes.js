import express from 'express';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, createCourse);
router.route('/company/:companyId').get(protect, getCourses);
router
  .route('/:id')
  .put(protect, updateCourse)
  .delete(protect, deleteCourse);

export default router;
