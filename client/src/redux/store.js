import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import companyReducer from './companySlice';
import studentReducer from './studentSlice';
import feeReducer from './feeSlice';
import ledgerReducer from './ledgerSlice';
import reportReducer from './reportSlice';
import feeReportsReducer from './feeReportsSlice';
import courseReducer from './courseSlice';
import expenseReducer from './expenseSlice';
import expenseCategoryReducer from './expenseCategorySlice';
import teacherReducer from './teacherSlice';
import purchaseReducer from './purchaseSlice';
import feeRefundReducer from './feeRefundSlice';
import purchaseReturnReducer from './purchaseReturnSlice';
import accountReducer from './accountSlice';
import backupReducer from './backupSlice';
import batchReducer from './batchSlice';
import attendanceReducer from './attendanceSlice';
import examReducer from './examSlice';
import enquiryReducer from './enquirySlice';
import feeManagementReducer from './feeManagementSlice';
import enrollmentReducer from './enrollmentSlice';
import assetReducer from './assetSlice';
import payrollReducer from './payrollSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    companies: companyReducer,
    students: studentReducer,
    fees: feeReducer,
    ledger: ledgerReducer,
    reports: reportReducer,
    feeReports: feeReportsReducer,
    courses: courseReducer,
    expenses: expenseReducer,
    expenseCategories: expenseCategoryReducer,
    teachers: teacherReducer,
    purchases: purchaseReducer,
    feeRefunds: feeRefundReducer,
    purchaseReturns: purchaseReturnReducer,
    accounts: accountReducer,
    backup: backupReducer,
    batches: batchReducer,
    attendance: attendanceReducer,
    exams: examReducer,
    enquiries: enquiryReducer,
    feeManagement: feeManagementReducer,
    enrollments: enrollmentReducer,
    assets: assetReducer,
    payroll: payrollReducer,
  },
});
