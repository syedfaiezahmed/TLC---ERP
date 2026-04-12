import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

// Fee Collection Report
export const fetchFeeCollectionReport = createAsyncThunk(
  'reports/fetchFeeCollectionReport',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await api.fetchFeeCollectionReport(companyId, params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch fee collection report' });
    }
  }
);

// Pending Fees Report
export const fetchPendingFeesReport = createAsyncThunk(
  'reports/fetchPendingFeesReport',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await api.fetchPendingFeesReport(companyId, params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch pending fees report' });
    }
  }
);

// Student Ledger Report
export const fetchStudentLedgerReport = createAsyncThunk(
  'reports/fetchStudentLedgerReport',
  async ({ companyId, studentId, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await api.fetchStudentLedgerReport(companyId, studentId, params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch student ledger report' });
    }
  }
);

// Summary Report
export const fetchSummaryReport = createAsyncThunk(
  'reports/fetchSummaryReport',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await api.fetchFeeSummaryReport(companyId, params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch summary report' });
    }
  }
);

// Voucher Report
export const fetchVoucherReport = createAsyncThunk(
  'reports/fetchVoucherReport',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await api.fetchVoucherReport(companyId, params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch voucher report' });
    }
  }
);

const initialState = {
  // Fee Collection Report
  feeCollectionReport: {
    payments: [],
    summary: {},
    pagination: {},
    filters: {}
  },
  
  // Pending Fees Report
  pendingFeesReport: {
    pendingFees: [],
    summary: {},
    pagination: {},
    filters: {}
  },
  
  // Student Ledger Report
  studentLedgerReport: {
    student: null,
    transactions: [],
    summary: {},
    reportPeriod: {}
  },
  
  // Summary Report
  summaryReport: {
    summary: [],
    totals: {},
    period: {}
  },
  
  // Voucher Report
  voucherReport: {
    vouchers: [],
    summary: {},
    pagination: {},
    filters: {}
  },
  
  // Loading states
  loading: {
    feeCollection: false,
    pendingFees: false,
    studentLedger: false,
    summary: false,
    vouchers: false
  },
  
  // Error states
  errors: {
    feeCollection: null,
    pendingFees: null,
    studentLedger: null,
    summary: null,
    vouchers: null
  }
};

const feeReportsSlice = createSlice({
  name: 'feeReports',
  initialState,
  reducers: {
    clearErrors: (state, action) => {
      const { reportType } = action.payload;
      if (reportType && state.errors[reportType]) {
        state.errors[reportType] = null;
      }
    },
    
    clearAllErrors: (state) => {
      Object.keys(state.errors).forEach(key => {
        state.errors[key] = null;
      });
    },
    
    resetReport: (state, action) => {
      const { reportType } = action.payload;
      if (reportType && state[`${reportType}Report`]) {
        state[`${reportType}Report`] = initialState[`${reportType}Report`];
      }
    },
    
    updateFilters: (state, action) => {
      const { reportType, filters } = action.payload;
      if (reportType && state[`${reportType}Report`]) {
        state[`${reportType}Report`].filters = { ...state[`${reportType}Report`].filters, ...filters };
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fee Collection Report
      .addCase(fetchFeeCollectionReport.pending, (state) => {
        state.loading.feeCollection = true;
        state.errors.feeCollection = null;
      })
      .addCase(fetchFeeCollectionReport.fulfilled, (state, action) => {
        state.loading.feeCollection = false;
        state.feeCollectionReport = action.payload;
      })
      .addCase(fetchFeeCollectionReport.rejected, (state, action) => {
        state.loading.feeCollection = false;
        state.errors.feeCollection = action.payload?.message || 'Failed to fetch fee collection report';
      })
      
      // Pending Fees Report
      .addCase(fetchPendingFeesReport.pending, (state) => {
        state.loading.pendingFees = true;
        state.errors.pendingFees = null;
      })
      .addCase(fetchPendingFeesReport.fulfilled, (state, action) => {
        state.loading.pendingFees = false;
        state.pendingFeesReport = action.payload;
      })
      .addCase(fetchPendingFeesReport.rejected, (state, action) => {
        state.loading.pendingFees = false;
        state.errors.pendingFees = action.payload?.message || 'Failed to fetch pending fees report';
      })
      
      // Student Ledger Report
      .addCase(fetchStudentLedgerReport.pending, (state) => {
        state.loading.studentLedger = true;
        state.errors.studentLedger = null;
      })
      .addCase(fetchStudentLedgerReport.fulfilled, (state, action) => {
        state.loading.studentLedger = false;
        state.studentLedgerReport = action.payload;
      })
      .addCase(fetchStudentLedgerReport.rejected, (state, action) => {
        state.loading.studentLedger = false;
        state.errors.studentLedger = action.payload?.message || 'Failed to fetch student ledger report';
      })
      
      // Summary Report
      .addCase(fetchSummaryReport.pending, (state) => {
        state.loading.summary = true;
        state.errors.summary = null;
      })
      .addCase(fetchSummaryReport.fulfilled, (state, action) => {
        state.loading.summary = false;
        state.summaryReport = action.payload;
      })
      .addCase(fetchSummaryReport.rejected, (state, action) => {
        state.loading.summary = false;
        state.errors.summary = action.payload?.message || 'Failed to fetch summary report';
      })
      
      // Voucher Report
      .addCase(fetchVoucherReport.pending, (state) => {
        state.loading.vouchers = true;
        state.errors.vouchers = null;
      })
      .addCase(fetchVoucherReport.fulfilled, (state, action) => {
        state.loading.vouchers = false;
        state.voucherReport = action.payload;
      })
      .addCase(fetchVoucherReport.rejected, (state, action) => {
        state.loading.vouchers = false;
        state.errors.vouchers = action.payload?.message || 'Failed to fetch voucher report';
      });
  }
});

export const { clearErrors, clearAllErrors, resetReport, updateFilters } = feeReportsSlice.actions;

// Selectors
export const selectFeeCollectionReport = (state) => state.feeReports?.feeCollectionReport || initialState.feeCollectionReport;
export const selectPendingFeesReport = (state) => state.feeReports?.pendingFeesReport || initialState.pendingFeesReport;
export const selectStudentLedgerReport = (state) => state.feeReports?.studentLedgerReport || initialState.studentLedgerReport;
export const selectSummaryReport = (state) => state.feeReports?.summaryReport || initialState.summaryReport;
export const selectVoucherReport = (state) => state.feeReports?.voucherReport || initialState.voucherReport;

export const selectLoading = (state) => state.feeReports?.loading || initialState.loading;
export const selectErrors = (state) => state.feeReports?.errors || initialState.errors;

export const selectLoadingByType = (state, reportType) => state.feeReports?.loading?.[reportType] || false;
export const selectErrorByType = (state, reportType) => state.feeReports?.errors?.[reportType] || null;

export default feeReportsSlice.reducer;
