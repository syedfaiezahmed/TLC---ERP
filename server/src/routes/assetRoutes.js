import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  postDepreciationForMonth,
  getDepreciationHistory,
} from '../controllers/assetController.js';

const router = express.Router();

router.use(protect);

router.route('/').post(authorize('admin', 'accountant', 'superadmin'), createAsset);
router.route('/company/:companyId').get(authorize('admin', 'accountant', 'superadmin'), getAssets);
router.route('/company/:companyId/post-depreciation').post(authorize('admin', 'accountant', 'superadmin'), postDepreciationForMonth);
router.route('/:id').get(authorize('admin', 'accountant', 'superadmin'), getAssetById)
  .put(authorize('admin', 'accountant', 'superadmin'), updateAsset)
  .delete(authorize('admin', 'accountant', 'superadmin'), deleteAsset);
router.route('/:id/depreciation-history').get(authorize('admin', 'accountant', 'superadmin'), getDepreciationHistory);

export default router;

