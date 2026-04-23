import express from 'express';
import {
  generatePayroll,
  generateBulkPayroll,
  getPayrollByCompany,
  getPayrollById,
  approvePayroll,
  recordPayrollPayment,
  updatePayroll,
  deletePayroll,
  getPayrollSummary,
  getPayrollPrintData,
} from '../controllers/payrollController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/generate').post(authorize('admin', 'accountant', 'superadmin'), generatePayroll);
router.route('/bulk-generate').post(authorize('admin', 'accountant', 'superadmin'), generateBulkPayroll);
router.route('/company/:companyId').get(authorize('admin', 'accountant', 'superadmin', 'teacher'), getPayrollByCompany);
router.route('/company/:companyId/summary').get(authorize('admin', 'accountant', 'superadmin'), getPayrollSummary);
router.route('/:id').get(authorize('admin', 'accountant', 'superadmin', 'teacher'), getPayrollById);
router.route('/:id/print-data').get(authorize('admin', 'accountant', 'superadmin', 'teacher'), getPayrollPrintData);
router.route('/:id/approve').put(authorize('admin', 'accountant', 'superadmin'), approvePayroll);
router.route('/:id/payment').post(authorize('admin', 'accountant', 'superadmin'), recordPayrollPayment);
router.route('/:id')
  .put(authorize('admin', 'accountant', 'superadmin'), updatePayroll)
  .delete(authorize('admin', 'superadmin'), deletePayroll);

export default router;
