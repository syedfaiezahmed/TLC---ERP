import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';
import { getCache, setCache, makeKey } from '../utils/cache';

export const getRevenueReport = createAsyncThunk('reports/getRevenueReport', async ({ companyId, startDate, endDate }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchRevenueReport(companyId, startDate, endDate);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getReceivablesReport = createAsyncThunk('reports/getReceivablesReport', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchReceivablesReport(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getReceivablesAgingReport = createAsyncThunk('reports/getReceivablesAgingReport', async (companyId, { rejectWithValue }) => {
  try {
    const key = makeKey('receivables-aging', { companyId });
    const cached = getCache(key);
    if (cached) return cached;
    const { data } = await api.fetchReceivablesAgingReport(companyId);
    setCache(key, data, 20);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getPayablesAgingReport = createAsyncThunk('reports/getPayablesAgingReport', async (companyId, { rejectWithValue }) => {
  try {
    const key = makeKey('payables-aging', { companyId });
    const cached = getCache(key);
    if (cached) return cached;
    const { data } = await api.fetchPayablesAgingReport(companyId);
    setCache(key, data, 20);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getTeacherStatement = createAsyncThunk('reports/getTeacherStatement', async ({ companyId, startDate, endDate, teacherId }, { rejectWithValue }) => {
  try {
    const key = makeKey('teacher-statement', { companyId, startDate, endDate, teacherId });
    const cached = getCache(key);
    if (cached) return cached;
    const { data } = await api.fetchTeacherStatement(companyId, { startDate, endDate, teacherId });
    setCache(key, data, 20);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getTrialBalance = createAsyncThunk('reports/getTrialBalance', async ({ companyId, startDate, endDate }, { rejectWithValue }) => {
  try {
    const key = makeKey('trial-balance', { companyId, startDate, endDate });
    const cached = getCache(key);
    if (cached) return cached;
    const { data } = await api.fetchTrialBalance(companyId, { startDate, endDate });
    setCache(key, data, 20);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const fetchDashboardSummary = createAsyncThunk('reports/fetchDashboardSummary', async (companyId, { rejectWithValue }) => {
  try {
    const key = makeKey('dashboard-summary', { companyId });
    const cached = getCache(key);
    if (cached) return cached;
    const { data } = await api.fetchDashboardSummary(companyId);
    setCache(key, data, 20);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getDashboardSummary = fetchDashboardSummary;

export const fetchDashboardChartData = createAsyncThunk('reports/fetchDashboardChartData', async (companyId, { rejectWithValue }) => {
  try {
    const key = makeKey('dashboard-chart', { companyId });
    const cached = getCache(key);
    if (cached) return cached;
    const { data } = await api.fetchDashboardChartData(companyId);
    setCache(key, data, 20);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getDashboardChartData = fetchDashboardChartData;

export const getRevenueDetailReport = createAsyncThunk('reports/getRevenueDetailReport', async ({ companyId, startDate, endDate, studentId }, { rejectWithValue }) => {
    try {
        const key = makeKey('revenue-detail', { companyId, startDate, endDate, studentId });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchRevenueDetailReport(companyId, startDate, endDate, studentId);
        setCache(key, data, 20);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getTeacherExpensesDetailReport = createAsyncThunk('reports/getTeacherExpensesDetailReport', async ({ companyId, startDate, endDate, teacherId }, { rejectWithValue }) => {
    try {
        const key = makeKey('teacher-expenses-detail', { companyId, startDate, endDate, teacherId });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchPurchasesDetailReport(companyId, startDate, endDate, teacherId);
        setCache(key, data, 20);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getStudentStatement = createAsyncThunk('reports/getStudentStatement', async ({ companyId, startDate, endDate, studentId }, { rejectWithValue }) => {
    try {
        const key = makeKey('student-statement', { companyId, startDate, endDate, studentId });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchStudentStatement(companyId, { startDate, endDate, studentId });
        setCache(key, data, 20);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getProfitAndLoss = createAsyncThunk('reports/getProfitAndLoss', async ({ companyId, startDate, endDate }, { rejectWithValue }) => {
    try {
        const key = makeKey('pnl', { companyId, startDate, endDate });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchProfitAndLoss(companyId, startDate, endDate);
        setCache(key, data, 20);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getBalanceSheet = createAsyncThunk('reports/getBalanceSheet', async ({ companyId, asOfDate }, { rejectWithValue }) => {
    try {
        const key = makeKey('balance-sheet', { companyId, asOfDate });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchBalanceSheet(companyId, asOfDate);
        setCache(key, data, 20);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getGeneralLedgerReport = createAsyncThunk('reports/getGeneralLedgerReport', async ({ companyId, startDate, endDate, accountName, studentId, type }, { rejectWithValue }) => {
    try {
        const key = makeKey('general-ledger', { companyId, startDate, endDate, accountName, studentId, type });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchGeneralLedgerReport(companyId, { startDate, endDate, accountName, studentId, type });
        setCache(key, data, 15);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getInventoryValuationReport = createAsyncThunk('reports/getInventoryValuationReport', async (companyId, { rejectWithValue }) => {
    try {
        const key = makeKey('inventory', { companyId });
        const cached = getCache(key);
        if (cached) return cached;
        const data = [];
        setCache(key, data, 30);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getCashFlowStatement = createAsyncThunk('reports/getCashFlowStatement', async ({ companyId, startDate, endDate }, { rejectWithValue }) => {
    try {
        const key = makeKey('cash-flow', { companyId, startDate, endDate });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchCashFlowStatement(companyId, { startDate, endDate });
        setCache(key, data, 10);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const getPaymentsReport = createAsyncThunk('reports/getPaymentsReport', async ({ companyId, startDate, endDate, studentId }, { rejectWithValue }) => {
    try {
        const key = makeKey('payments-report', { companyId, startDate, endDate, studentId });
        const cached = getCache(key);
        if (cached) return cached;
        const { data } = await api.fetchPaymentsReport(companyId, { startDate, endDate, studentId });
        setCache(key, data, 15);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

const reportSlice = createSlice({
  name: 'reports',
  initialState: {
    revenueReport: [],
    receivablesReport: [],
    receivablesAgingReport: [],
    payablesAgingReport: [],
    revenueDetailReport: null,
    teacherExpensesDetailReport: null,
    studentStatement: null,
    studentStatementSummary: null,
    teacherStatement: [],
    teacherStatementSummary: null,
    trialBalance: null,
    generalLedgerReport: [],
    paymentsReport: [],
    profitAndLoss: null,
    balanceSheet: null,
    cashFlowStatement: null,
    summary: null,
    feeRevenue: 0,
    chartData: [],
    loading: false,
    error: null,
    reportError: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardChartData.pending, (state) => {
          state.loading = true;
      })
      .addCase(fetchDashboardChartData.fulfilled, (state, action) => {
          state.loading = false;
          state.chartData = action.payload;
      })
      .addCase(fetchDashboardChartData.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
      })
      .addCase(getGeneralLedgerReport.pending, (state) => {
          state.loading = true;
          state.reportError = null;
      })
      .addCase(getGeneralLedgerReport.fulfilled, (state, action) => {
          state.loading = false;
          state.generalLedgerReport = action.payload;
      })
      .addCase(getGeneralLedgerReport.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load general ledger';
      })
      .addCase(getPaymentsReport.pending, (state) => {
          state.loading = true;
      })
      .addCase(getPaymentsReport.fulfilled, (state, action) => {
          state.loading = false;
          state.paymentsReport = action.payload;
      })
      .addCase(getProfitAndLoss.pending, (state) => {
          state.loading = true;
          state.reportError = null;
      })
      .addCase(getProfitAndLoss.fulfilled, (state, action) => {
          state.loading = false;
          state.profitAndLoss = action.payload;
      })
      .addCase(getProfitAndLoss.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load P&L';
      })
      .addCase(getBalanceSheet.pending, (state) => {
          state.loading = true;
          state.reportError = null;
      })
      .addCase(getBalanceSheet.fulfilled, (state, action) => {
          state.loading = false;
          state.balanceSheet = action.payload;
      })
      .addCase(getBalanceSheet.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load balance sheet';
      })
      .addCase(getRevenueReport.pending, (state) => {
          state.loading = true;
      })
      .addCase(getRevenueReport.fulfilled, (state, action) => {
          state.loading = false;
          state.revenueReport = action.payload;
      })
      .addCase(getRevenueDetailReport.pending, (state) => {
          state.loading = true;
          state.reportError = null;
      })
      .addCase(getRevenueDetailReport.fulfilled, (state, action) => {
          state.loading = false;
          state.revenueDetailReport = action.payload;
      })
      .addCase(getTeacherExpensesDetailReport.pending, (state) => {
          state.loading = true;
          state.reportError = null;
      })
      .addCase(getTeacherExpensesDetailReport.fulfilled, (state, action) => {
          state.loading = false;
          state.teacherExpensesDetailReport = action.payload;
      })
      .addCase(getStudentStatement.pending, (state) => {
          state.loading = true;
      })
      .addCase(getStudentStatement.fulfilled, (state, action) => {
          state.loading = false;
          state.studentStatement = action.payload?.entries || [];
          state.studentStatementSummary = action.payload?.summary || null;
      })
      .addCase(getTeacherStatement.pending, (state) => {
          state.loading = true;
      })
      .addCase(getTeacherStatement.fulfilled, (state, action) => {
          state.loading = false;
          state.teacherStatement = action.payload?.entries || [];
          state.teacherStatementSummary = action.payload?.summary || null;
      })
      .addCase(getReceivablesReport.fulfilled, (state, action) => {
          state.receivablesReport = action.payload;
      })
      .addCase(getReceivablesAgingReport.fulfilled, (state, action) => {
          state.loading = false;
          state.receivablesAgingReport = action.payload;
      })
      .addCase(getPayablesAgingReport.fulfilled, (state, action) => {
          state.loading = false;
          state.payablesAgingReport = action.payload;
      })
      .addCase(fetchDashboardSummary.pending, (state) => {
          state.loading = true;
      })
      .addCase(fetchDashboardSummary.fulfilled, (state, action) => {
          state.loading = false;
          state.summary = action.payload;
      })
      .addCase(fetchDashboardSummary.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
      })
      .addCase(getTrialBalance.pending, (state) => { state.loading = true; state.reportError = null; })
      .addCase(getTrialBalance.fulfilled, (state, action) => {
          state.loading = false;
          state.trialBalance = action.payload;
      })
      .addCase(getTrialBalance.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load trial balance';
      })
      .addCase(getReceivablesAgingReport.pending, (state) => { state.loading = true; state.reportError = null; })
      .addCase(getReceivablesAgingReport.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load receivables aging';
      })
      .addCase(getPayablesAgingReport.pending, (state) => { state.loading = true; state.reportError = null; })
      .addCase(getPayablesAgingReport.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load payables aging';
      })
      .addCase(getCashFlowStatement.pending, (state) => { state.loading = true; state.reportError = null; })
      .addCase(getCashFlowStatement.fulfilled, (state, action) => { state.loading = false; state.cashFlowStatement = action.payload; })
      .addCase(getCashFlowStatement.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load cash flow statement';
      })
      .addCase(getTeacherStatement.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load teacher statement';
      })
      .addCase(getStudentStatement.rejected, (state, action) => {
          state.loading = false;
          state.reportError = action.payload?.message || 'Failed to load student statement';
      })
      // ── Global catch-all: any rejected action in this slice resets loading ──
      .addMatcher(
          (action) => action.type.startsWith('reports/') && action.type.endsWith('/rejected'),
          (state, action) => {
              state.loading = false;
              state.reportError = action.payload?.message || action.error?.message || 'Report failed to load';
          }
      );
  },
});

export default reportSlice.reducer;
