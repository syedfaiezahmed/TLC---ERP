import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const generateVouchers = createAsyncThunk('feeManagement/generateVouchers',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.generateVouchers(data);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchVouchers = createAsyncThunk('feeManagement/fetchVouchers',
  async (params, { rejectWithValue }) => {
    try {
      const res = await api.fetchVouchers(params);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchVoucherById = createAsyncThunk('feeManagement/fetchVoucherById',
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.fetchVoucherById(id);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchVoucherStatistics = createAsyncThunk('feeManagement/fetchVoucherStatistics',
  async (params, { rejectWithValue }) => {
    try {
      const res = await api.fetchVoucherStatistics(params || {});
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const updateVoucherStatus = createAsyncThunk('feeManagement/updateVoucherStatus',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.updateVoucherStatus(id, data);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const deleteVoucher = createAsyncThunk('feeManagement/deleteVoucher',
  async (id, { rejectWithValue }) => {
    try {
      await api.deleteVoucher(id);
      return id;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const collectFeePayment = createAsyncThunk('feeManagement/collectFeePayment',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.collectFeePayment(data);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const deleteFeePayment = createAsyncThunk('feeManagement/deleteFeePayment',
  async (paymentId, { rejectWithValue }) => {
    try {
      await api.deleteFeePayment(paymentId);
      return paymentId;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const validateFeePayment = createAsyncThunk('feeManagement/validateFeePayment',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.validateFeePayment(data);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchCollectionHistory = createAsyncThunk('feeManagement/fetchCollectionHistory',
  async (params, { rejectWithValue }) => {
    try {
      const res = await api.fetchCollectionHistory(params || {});
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchCollectionStatistics = createAsyncThunk('feeManagement/fetchCollectionStatistics',
  async (params, { rejectWithValue }) => {
    try {
      const res = await api.fetchCollectionStatistics(params || {});
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchStudentCollectionHistory = createAsyncThunk('feeManagement/fetchStudentCollectionHistory',
  async (studentId, { rejectWithValue }) => {
    try {
      const res = await api.fetchStudentCollectionHistory(studentId);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchBadDebts = createAsyncThunk('feeManagement/fetchBadDebts',
  async (params, { rejectWithValue }) => {
    try {
      const res = await api.fetchBadDebts(params);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const markAsBadDebt = createAsyncThunk('feeManagement/markAsBadDebt',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.markAsBadDebt(data);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchFeeCollectionReport = createAsyncThunk('feeManagement/fetchFeeCollectionReport',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const res = await api.fetchFeeCollectionReport(companyId, params);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchPendingFeesReport = createAsyncThunk('feeManagement/fetchPendingFeesReport',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const res = await api.fetchPendingFeesReport(companyId, params);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchStudentLedgerReport = createAsyncThunk('feeManagement/fetchStudentLedgerReport',
  async ({ companyId, studentId, ...params }, { rejectWithValue }) => {
    try {
      const res = await api.fetchStudentLedgerReport(companyId, studentId, params);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchFeeSummaryReport = createAsyncThunk('feeManagement/fetchFeeSummaryReport',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const res = await api.fetchFeeSummaryReport(companyId, params);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const fetchDailyCollectionSummary = createAsyncThunk('feeManagement/fetchDailyCollectionSummary',
  async (date, { rejectWithValue }) => {
    try {
      const res = await api.fetchDailyCollectionSummary(date);
      return res.data;
    } catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const feeManagementSlice = createSlice({
  name: 'feeManagement',
  initialState: {
    // Vouchers
    vouchers: [],
    vouchersPagination: {},
    selectedVoucher: null,
    voucherStats: null,

    // Collection
    collectionHistory: [],
    collectionStats: null,
    studentPaymentHistory: null,
    paymentValidation: null,

    // Reports
    collectionReport: null,
    pendingFeesReport: null,
    studentLedgerReport: null,
    summaryReport: null,
    dailyCollection: null,
    badDebts: [],
    badDebtsPagination: {},

    // UI state
    loading: {},
    errors: {},
    successMessage: null,
  },
  reducers: {
    clearSuccess: (state) => { state.successMessage = null; },
    clearError: (state, action) => { delete state.errors[action.payload]; },
    clearSelectedVoucher: (state) => { state.selectedVoucher = null; },
    clearPaymentValidation: (state) => { state.paymentValidation = null; },
    setError: (state, action) => {
      if (action.payload?.key) {
        state.errors[action.payload.key] = action.payload.message || 'An error occurred';
      }
    },
  },
  extraReducers: (builder) => {
    const handle = (thunk, key, onFulfilled) => {
      builder
        .addCase(thunk.pending, (state) => { state.loading[key] = true; delete state.errors[key]; })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key] = false;
          onFulfilled(state, action);
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading[key] = false;
          state.errors[key] = action.payload?.message || 'An error occurred';
        });
    };

    handle(generateVouchers, 'generate', (state, action) => {
      state.successMessage = action.payload.message;
      if (action.payload.vouchers) {
        state.vouchers = [...action.payload.vouchers, ...state.vouchers];
      }
    });
    handle(fetchVouchers, 'vouchers', (state, action) => {
      state.vouchers = action.payload.vouchers || action.payload.data || action.payload || [];
      state.vouchersPagination = action.payload.pagination || {};
    });
    handle(fetchVoucherById, 'voucherDetail', (state, action) => {
      state.selectedVoucher = action.payload.voucher || action.payload;
    });
    handle(fetchVoucherStatistics, 'voucherStats', (state, action) => {
      state.voucherStats = action.payload.statistics || action.payload;
    });
    handle(updateVoucherStatus, 'updateVoucher', (state, action) => {
      const updated = action.payload.voucher || action.payload;
      const idx = state.vouchers.findIndex(v => v._id === updated._id);
      if (idx !== -1) state.vouchers[idx] = updated;
      if (state.selectedVoucher?._id === updated._id) state.selectedVoucher = updated;
      state.successMessage = 'Voucher updated successfully';
    });
    handle(deleteVoucher, 'deleteVoucher', (state, action) => {
      state.vouchers = state.vouchers.filter(v => v._id !== action.payload);
      state.successMessage = 'Voucher deleted successfully';
    });
    handle(deleteFeePayment, 'deleteFeePayment', (state, action) => {
      state.collectionHistory = (state.collectionHistory || []).filter(p => p._id !== action.payload);
      state.successMessage = 'Payment deleted and journal reversed';
    });
    handle(collectFeePayment, 'collectPayment', (state, action) => {
      state.successMessage = action.payload.message || 'Payment recorded successfully';
      if (state.selectedVoucher) {
        const updated = action.payload.updatedVoucher;
        if (updated) state.selectedVoucher = updated;
      }
    });
    handle(validateFeePayment, 'validatePayment', (state, action) => {
      state.paymentValidation = action.payload.validation || action.payload;
    });
    handle(fetchCollectionHistory, 'collectionHistory', (state, action) => {
      state.collectionHistory = action.payload.payments || action.payload || [];
    });
    handle(fetchCollectionStatistics, 'collectionStats', (state, action) => {
      state.collectionStats = action.payload.statistics || action.payload;
    });
    handle(fetchStudentCollectionHistory, 'studentHistory', (state, action) => {
      state.studentPaymentHistory = action.payload;
    });
    handle(fetchBadDebts, 'badDebts', (state, action) => {
      state.badDebts = action.payload.badDebts || action.payload || [];
      state.badDebtsPagination = action.payload.pagination || {};
    });
    handle(markAsBadDebt, 'markBadDebt', (state, action) => {
      state.successMessage = action.payload.message || 'Marked as bad debt';
    });
    handle(fetchFeeCollectionReport, 'collectionReport', (state, action) => {
      state.collectionReport = action.payload;
    });
    handle(fetchPendingFeesReport, 'pendingReport', (state, action) => {
      state.pendingFeesReport = action.payload;
    });
    handle(fetchStudentLedgerReport, 'ledgerReport', (state, action) => {
      state.studentLedgerReport = action.payload;
    });
    handle(fetchFeeSummaryReport, 'summaryReport', (state, action) => {
      state.summaryReport = action.payload;
    });
    handle(fetchDailyCollectionSummary, 'dailyCollection', (state, action) => {
      state.dailyCollection = action.payload;
    });
  }
});

export const { clearSuccess, clearError, clearSelectedVoucher, clearPaymentValidation, setError } = feeManagementSlice.actions;
export default feeManagementSlice.reducer;
