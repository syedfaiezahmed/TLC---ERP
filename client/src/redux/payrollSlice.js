import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getPayrolls = createAsyncThunk('payroll/getPayrolls', async ({ companyId, params }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchPayrolls(companyId, params);
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

export const getPayrollSummary = createAsyncThunk('payroll/getSummary', async ({ companyId, month }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchPayrollSummary(companyId, month);
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

export const generatePayroll = createAsyncThunk('payroll/generate', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.generatePayroll(payload);
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

export const generateBulkPayroll = createAsyncThunk('payroll/bulkGenerate', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.generateBulkPayroll(payload);
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

export const approvePayroll = createAsyncThunk('payroll/approve', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.approvePayroll(id);
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

export const payPayroll = createAsyncThunk('payroll/pay', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.payPayroll(id, payload);
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

export const updatePayroll = createAsyncThunk('payroll/update', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.updatePayroll(id, payload);
    return data;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

export const deletePayroll = createAsyncThunk('payroll/delete', async (id, { rejectWithValue }) => {
  try {
    await api.deletePayroll(id);
    return id;
  } catch (e) {
    return rejectWithValue(e.response?.data || { message: e.message });
  }
});

const payrollSlice = createSlice({
  name: 'payroll',
  initialState: {
    payrolls: [],
    summary: null,
    total: 0,
    loading: false,
    summaryLoading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // getPayrolls
      .addCase(getPayrolls.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(getPayrolls.fulfilled, (state, action) => {
        state.loading = false;
        state.payrolls = action.payload.payrolls || [];
        state.total = action.payload.total || 0;
      })
      .addCase(getPayrolls.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      // summary
      .addCase(getPayrollSummary.pending, (state) => { state.summaryLoading = true; })
      .addCase(getPayrollSummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        state.summary = action.payload;
      })
      .addCase(getPayrollSummary.rejected, (state) => { state.summaryLoading = false; })
      // generatePayroll
      .addCase(generatePayroll.fulfilled, (state, action) => {
        state.payrolls.unshift(action.payload);
      })
      // generateBulkPayroll — refetch is handled via dispatch
      // approvePayroll
      .addCase(approvePayroll.fulfilled, (state, action) => {
        const idx = state.payrolls.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.payrolls[idx] = action.payload;
      })
      // payPayroll
      .addCase(payPayroll.fulfilled, (state, action) => {
        const idx = state.payrolls.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.payrolls[idx] = action.payload;
      })
      // updatePayroll
      .addCase(updatePayroll.fulfilled, (state, action) => {
        const idx = state.payrolls.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.payrolls[idx] = action.payload;
      })
      // deletePayroll
      .addCase(deletePayroll.fulfilled, (state, action) => {
        state.payrolls = state.payrolls.filter((p) => p._id !== action.payload);
      });
  },
});

export const { clearError } = payrollSlice.actions;
export default payrollSlice.reducer;
