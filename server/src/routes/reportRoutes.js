import express from 'express';
import { 
    getRevenueReport, 
    getReceivablesReport, 
    getReceivablesAgingReport,
    getPayablesAgingReport,
    getDashboardSummary, 
    getRevenueDetailReport, 
    getPurchasesDetailReport,
    getDashboardChartData,
    getStudentStatement,
    getTeacherStatement,
    getTrialBalance,
    getProfitAndLoss,
    getBalanceSheet,
    getGeneralLedgerReport,
    getPaymentsReport,
    getCashFlowStatement,
    purgeDoubleFeeRevenueEntries,
    getFinancialValidation
} from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/revenue/:companyId', protect, getRevenueReport);
router.get('/receivables/:companyId', protect, getReceivablesReport);
router.get('/receivables-aging/:companyId', protect, getReceivablesAgingReport);
router.get('/payables-aging/:companyId', protect, getPayablesAgingReport);
router.get('/dashboard/:companyId', protect, getDashboardSummary);
router.get('/revenue-detail/:companyId', protect, getRevenueDetailReport);
router.get('/purchases-detail/:companyId', protect, getPurchasesDetailReport);
router.get('/chart/:companyId', protect, getDashboardChartData);
router.get('/statement/:companyId', protect, getStudentStatement);
router.get('/teacher-statement/:companyId', protect, getTeacherStatement);
router.get('/trial-balance/:companyId', protect, getTrialBalance);
router.get('/pnl/:companyId', protect, getProfitAndLoss);
router.get('/balance-sheet/:companyId', protect, getBalanceSheet);
router.get('/ledger/:companyId', protect, getGeneralLedgerReport);
router.get('/payments/:companyId', protect, getPaymentsReport);
router.get('/cash-flow/:companyId', protect, getCashFlowStatement);
router.post('/admin/purge-duplicate-fee-revenue/:companyId', protect, purgeDoubleFeeRevenueEntries);
router.get('/validate/:companyId', protect, getFinancialValidation);

export default router;
