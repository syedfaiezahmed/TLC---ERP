import axios from 'axios';

// Use environment variable for API URL in production, or default to relative /api
const API = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || '/api' 
});

API.interceptors.request.use((req) => {
  if (localStorage.getItem('profile')) {
    req.headers.Authorization = `Bearer ${JSON.parse(localStorage.getItem('profile')).token}`;
  }
  return req;
});

export const signIn = (formData) => API.post('/users/login', formData);
export const register = (formData) => API.post('/users', formData);

export const fetchCompanies = () => API.get('/companies');
export const createCompany = (newCompany) => API.post('/companies', newCompany);
export const updateCompany = (id, updatedCompany) => API.put(`/companies/${id}`, updatedCompany);
export const deleteCompany = (id) => API.delete(`/companies/${id}`);

export const fetchStudents = (companyId, { page = 1, limit = 20, search = '' } = {}) => {
    let url = `/students/company/${companyId}?page=${page}&limit=${limit}`;
    if (search) url += `&search=${search}`;
    return API.get(url);
};
export const createStudent = (newStudent) => API.post('/students', newStudent);
export const updateStudent = (id, updatedStudent) => API.put(`/students/${id}`, updatedStudent);
export const deleteStudent = (id) => API.delete(`/students/${id}`);

export const fetchFees = (companyId, page = 1, limit = 20, search = '', status = '', startDate = '', endDate = '', studentId = '') => {
    let url = `/fees/company/${companyId}?page=${page}&limit=${limit}`;
    if (search) url += `&search=${search}`;
    if (status) url += `&status=${status}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (studentId) url += `&studentId=${studentId}`;
    return API.get(url);
};
export const createFee = (newFee) => API.post('/fees', newFee);
export const updateFee = (id, updatedFee) => API.put(`/fees/${id}`, updatedFee);
export const deleteFee = (id) => API.delete(`/fees/${id}`);
export const fetchFee = (id) => API.get(`/fees/${id}`);
export const recordPayment = (id, paymentData) => API.post(`/fees/${id}/payment`, paymentData);
export const deletePayment = (paymentId) => API.delete(`/fees/payment/${paymentId}`);
export const recordGenericPayment = (studentId, paymentData) => API.post(`/fees/student/${studentId}/payment`, paymentData);
export const getPaymentDetails = (feeId, paymentId) => API.get(`/fees/${feeId}/payment/${paymentId}`);

export const fetchLedger = (companyId, page = 1, limit = 50, startDate = '', endDate = '', accountName = '', studentId = '', search = '', type = '') => {
    let url = `/ledger/company/${companyId}?page=${page}&limit=${limit}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (accountName && accountName !== 'all') url += `&accountName=${accountName}`;
    if (studentId) url += `&studentId=${studentId}`;
    if (search) url += `&search=${search}`;
    if (type && type !== 'all') url += `&type=${type}`;
    return API.get(url);
};
export const createLedgerEntry = (entry) => API.post('/ledger', entry);
export const createJournalEntry = (journal) => API.post('/ledger/journal', journal);
export const syncLedger = (companyId) => API.post(`/ledger/sync/${companyId}`);
export const updateLedgerEntry = (id, entry) => API.put(`/ledger/${id}`, entry);
export const deleteLedgerEntry = (id) => API.delete(`/ledger/${id}`);

export const fetchCourses = (companyId) => API.get(`/courses/company/${companyId}`);
export const createCourse = (newCourse) => API.post('/courses', newCourse);
export const updateCourse = (id, updatedCourse) => API.put(`/courses/${id}`, updatedCourse);
export const deleteCourse = (id) => API.delete(`/courses/${id}`);

export const fetchDashboardSummary = (companyId) => API.get(`/reports/dashboard/${companyId}`);
export const fetchDashboardChartData = (companyId) => API.get(`/reports/chart/${companyId}`);
export const fetchStudentStatement = (companyId, params) => API.get(`/reports/statement/${companyId}`, { params });
export const fetchProfitAndLoss = (companyId, startDate, endDate) => API.get(`/reports/pnl/${companyId}`, { params: { startDate, endDate } });
export const fetchBalanceSheet = (companyId, asOfDate) => API.get(`/reports/balance-sheet/${companyId}`, { params: { asOfDate } });
export const fetchRevenueReport = (companyId, startDate, endDate) => API.get(`/reports/revenue/${companyId}`, { params: { startDate, endDate } });
export const fetchRevenueDetailReport = (companyId, startDate, endDate, studentId) => API.get(`/reports/revenue-detail/${companyId}`, { params: { startDate, endDate, studentId: studentId || undefined } });
export const fetchPurchasesDetailReport = (companyId, startDate, endDate, teacherId) => API.get(`/reports/purchases-detail/${companyId}`, { params: { startDate, endDate, teacherId: teacherId || undefined } });
export const fetchReceivablesReport = (companyId) => API.get(`/reports/receivables/${companyId}`);
export const fetchReceivablesAgingReport = (companyId) => API.get(`/reports/receivables-aging/${companyId}`);
export const fetchPayablesAgingReport = (companyId) => API.get(`/reports/payables-aging/${companyId}`);
export const fetchGeneralLedgerReport = (companyId, params) => API.get(`/reports/ledger/${companyId}`, { params });
export const fetchTeacherStatement = (companyId, params) => API.get(`/reports/teacher-statement/${companyId}`, { params });
export const fetchTrialBalance = (companyId, params) => API.get(`/reports/trial-balance/${companyId}`, { params });
export const fetchPaymentsReport = (companyId, params) => API.get(`/reports/payments/${companyId}`, { params });
export const fetchCashFlowStatement = (companyId, params) => API.get(`/reports/cash-flow/${companyId}`, { params });

export const fetchExpenses = (companyId, params) => API.get(`/expenses/company/${companyId}`, { params });
export const createExpense = (expenseData) => API.post('/expenses', expenseData);
export const deleteExpense = (id) => API.delete(`/expenses/${id}`);

export const fetchExpenseCategories = (companyId) => API.get(`/expense-categories/company/${companyId}`);
export const createExpenseCategory = (categoryData) => API.post('/expense-categories', categoryData);
export const deleteExpenseCategory = (id) => API.delete(`/expense-categories/${id}`);

export const fetchTeachers = (companyId, params) => API.get(`/teachers/company/${companyId}`, { params });
export const createTeacher = (teacherData) => API.post('/teachers', teacherData);
export const updateTeacher = (id, teacherData) => API.put(`/teachers/${id}`, teacherData);
export const deleteTeacher = (id) => API.delete(`/teachers/${id}`);

export const fetchPurchases = (companyId, params) => API.get(`/purchases/company/${companyId}`, { params });
export const createPurchase = (purchaseData) => API.post('/purchases', purchaseData);
export const recordTeacherPayment = (id, paymentData) => API.post(`/purchases/${id}/pay`, paymentData);
export const fetchPurchase = (id) => API.get(`/purchases/${id}`);
export const updatePurchase = (id, payload) => API.put(`/purchases/${id}`, payload);
export const deletePurchase = (id) => API.delete(`/purchases/${id}`);
export const deletePurchasePayment = (purchaseId, paymentId) => API.delete(`/purchases/${purchaseId}/pay/${paymentId}`);

export const fetchBatches = (companyId) => API.get('/batches');
export const createBatch = (newBatch) => API.post('/batches', newBatch);
export const updateBatch = (id, updatedBatch) => API.put(`/batches/${id}`, updatedBatch);
export const deleteBatch = (id) => API.delete(`/batches/${id}`);

export const fetchAttendance = (params) => API.get('/attendance', { params });
export const markAttendanceBulk = (payload) => API.post('/attendance/bulk', payload);
export const deleteAttendance = (id) => API.delete(`/attendance/${id}`);
export const fetchMonthlyAttendanceRegister = (params) => API.get('/attendance/monthly-register', { params });
export const fetchAttendanceReport = (params) => API.get('/attendance/report', { params });
export const fetchAttendanceStats = (params) => API.get('/attendance/stats', { params });

export const fetchExams = () => API.get('/exams');
export const fetchExam = (id) => API.get(`/exams/${id}`);
export const createExam = (newExam) => API.post('/exams', newExam);
export const updateExam = (id, updatedExam) => API.put(`/exams/${id}`, updatedExam);
export const deleteExam = (id) => API.delete(`/exams/${id}`);
export const saveExamResults = (id, results) => API.post(`/exams/${id}/results`, { results });

export const fetchEnquiries = () => API.get('/enquiries');
export const createEnquiry = (newEnquiry) => API.post('/enquiries', newEnquiry);
export const updateEnquiry = (id, updatedEnquiry) => API.put(`/enquiries/${id}`, updatedEnquiry);
export const deleteEnquiry = (id) => API.delete(`/enquiries/${id}`);

export const fetchAccounts = (companyId) => API.get(`/accounts/company/${companyId}`);
export const createAccount = (accountData) => API.post('/accounts', accountData);
export const updateAccount = (id, accountData) => API.put(`/accounts/${id}`, accountData);
export const deleteAccount = (id) => API.delete(`/accounts/${id}`);

export const fetchPeriodLock = (companyId) => API.get(`/period-lock/${companyId}`);
export const setPeriodLock = (companyId, payload) => API.put(`/period-lock/${companyId}`, payload);
export const clearPeriodLock = (companyId) => API.delete(`/period-lock/${companyId}`);

export const fetchAuditLogs = (companyId, params) => API.get(`/audit/company/${companyId}`, { params });

export const fetchFeeRefunds = (companyId) => API.get(`/fee-refunds/company/${companyId}`);
export const fetchFeeRefund = (id) => API.get(`/fee-refunds/${id}`);
export const createFeeRefund = (payload) => API.post('/fee-refunds', payload);
export const deleteFeeRefund = (id) => API.delete(`/fee-refunds/${id}`);

export const fetchPurchaseReturns = (companyId) => API.get(`/purchase-returns/company/${companyId}`);
export const fetchPurchaseReturn = (id) => API.get(`/purchase-returns/${id}`);
export const createPurchaseReturn = (payload) => API.post('/purchase-returns', payload);
export const deletePurchaseReturn = (id) => API.delete(`/purchase-returns/${id}`);

export const createBackup = (password) => API.get(`/backup/export${password ? `?password=${encodeURIComponent(password)}` : ''}`);
export const restoreBackup = (data) => API.post('/backup/restore', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
});
export const getBackupHistory = (companyId) => API.get(`/backup/history/${companyId}`);

// ─── Fee Voucher Generation ───────────────────────────────────────────────────
export const generateVouchers = (data) => API.post('/enhanced-vouchers/generate', data);
export const fetchVouchers = (params) => API.get('/enhanced-vouchers', { params });
export const fetchVoucherById = (id) => API.get(`/enhanced-vouchers/${id}`);
export const fetchVoucherForPrint = (id) => API.get(`/enhanced-vouchers/${id}/print`);
export const updateVoucherStatus = (id, data) => API.patch(`/enhanced-vouchers/${id}/status`, data);
export const deleteVoucher = (id) => API.delete(`/enhanced-vouchers/${id}`);
export const fetchVoucherStatistics = (params) => API.get('/enhanced-vouchers/statistics', { params });

// ─── Fee Collection ───────────────────────────────────────────────────────────
export const collectFeePayment = (data) => API.post('/fee-collection/collect', data);
export const deleteFeePayment = (paymentId) => API.delete(`/fee-collection/payment/${paymentId}`);
export const validateFeePayment = (data) => API.post('/fee-collection/validate', data);
export const fetchCollectionHistory = (params) => API.get('/fee-collection/history', { params });
export const fetchCollectionStatistics = (params) => API.get('/fee-collection/statistics', { params });
export const fetchDailyCollectionSummary = (date) => API.get('/fee-collection/daily-summary', { params: { date } });
export const fetchMonthlyCollectionSummary = (year, month) => API.get('/fee-collection/monthly-summary', { params: { year, month } });
export const fetchStudentCollectionHistory = (studentId) => API.get(`/fee-collection/student/${studentId}`);
export const refundFeePayment = (paymentId, data) => API.post(`/fee-collection/payment/${paymentId}/refund`, data);
export const syncFeeJournals = () => API.post('/fee-collection/sync-journals');

// ─── Bad Debts ────────────────────────────────────────────────────────────────
export const fetchBadDebts = (params) => API.get('/bad-debts', { params });
export const fetchBadDebtSummary = () => API.get('/bad-debts/summary');
export const markAsBadDebt = (data) => API.post('/bad-debts/mark', data);
export const recoverBadDebt = (id, data) => API.post(`/bad-debts/${id}/recover`, data);

// ─── Fee Reports ──────────────────────────────────────────────────────────────
export const fetchFeeCollectionReport = (companyId, params) => API.get(`/fee-reports/fee-collection/${companyId}`, { params });
export const fetchPendingFeesReport = (companyId, params) => API.get(`/fee-reports/pending-fees/${companyId}`, { params });
export const fetchStudentLedgerReport = (companyId, studentId, params) => API.get(`/fee-reports/student-ledger/${companyId}/${studentId}`, { params });
export const fetchFeeSummaryReport = (companyId, params) => API.get(`/fee-reports/summary/${companyId}`, { params });
export const fetchVoucherReport = (companyId, params) => API.get(`/fee-reports/vouchers/${companyId}`, { params });

// ─── Enrollments ─────────────────────────────────────────────────────────────
export const fetchEnrollmentsByCompany = (companyId, params = {}) => {
    let url = `/enrollments/company/${companyId}`;
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.status) query.append('status', params.status);
    if (params.studentId) query.append('studentId', params.studentId);
    if (params.courseId) query.append('courseId', params.courseId);
    if (query.toString()) url += `?${query.toString()}`;
    return API.get(url);
};
export const fetchStudentEnrollments = (studentId, params = {}) => {
    let url = `/enrollments/student/${studentId}`;
    if (params.status) url += `?status=${params.status}`;
    return API.get(url);
};
export const createEnrollment = (data) => API.post('/enrollments', data);
export const updateEnrollment = (id, data) => API.put(`/enrollments/${id}`, data);
export const deleteEnrollment = (id) => API.delete(`/enrollments/${id}`);
export const fetchEnrollmentStatistics = (companyId, params = {}) => {
    let url = `/enrollments/statistics/${companyId}`;
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (query.toString()) url += `?${query.toString()}`;
    return API.get(url);
};

// ── Payroll ───────────────────────────────────────────────────────────────────
export const fetchPayrolls = (companyId, params) => API.get(`/payroll/company/${companyId}`, { params });
export const fetchPayrollSummary = (companyId, month) => API.get(`/payroll/company/${companyId}/summary`, { params: { month } });
export const fetchPayrollById = (id) => API.get(`/payroll/${id}`);
export const generatePayroll = (payload) => API.post('/payroll/generate', payload);
export const generateBulkPayroll = (payload) => API.post('/payroll/bulk-generate', payload);
export const approvePayroll = (id) => API.put(`/payroll/${id}/approve`);
export const payPayroll = (id, payload) => API.post(`/payroll/${id}/payment`, payload);
export const updatePayroll = (id, payload) => API.put(`/payroll/${id}`, payload);
export const deletePayroll = (id) => API.delete(`/payroll/${id}`);

// ── Assets & Depreciation ───────────────────────────────────────────────────
export const fetchAssets = (companyId) => API.get(`/assets/company/${companyId}`);
export const fetchAssetById = (id) => API.get(`/assets/${id}`);
export const createAsset = (data) => API.post('/assets', data);
export const updateAsset = (id, data) => API.put(`/assets/${id}`, data);
export const deleteAsset = (id) => API.delete(`/assets/${id}`);
export const fetchDepreciationHistory = (assetId) => API.get(`/assets/${assetId}/depreciation-history`);
export const postDepreciationForMonth = (companyId, month) =>
    API.post(`/assets/company/${companyId}/post-depreciation${month ? `?month=${month}` : ''}`);
