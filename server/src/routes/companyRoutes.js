// Single-company mode: only GET (Settings/Navbar) and PUT (Settings save) remain.
// Removed: POST /, GET / (list), DELETE /:id
import express from 'express';
import {
  getCompanyById,
  updateCompany,
} from '../controllers/companyController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router
  .route('/:id')
  .get(protect, admin, getCompanyById)
  .put(protect, admin, updateCompany);

export default router;
