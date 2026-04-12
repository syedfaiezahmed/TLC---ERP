import express from 'express';
import {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} from '../controllers/companyController.js';
import { protect, admin, superadmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, superadmin, createCompany).get(protect, admin, getCompanies);
router
  .route('/:id')
  .get(protect, admin, getCompanyById)
  .put(protect, admin, updateCompany)
  .delete(protect, superadmin, deleteCompany);

export default router;
