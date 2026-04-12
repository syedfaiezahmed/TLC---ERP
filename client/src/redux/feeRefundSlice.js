import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getPaymentHistory = createAsyncThunk('feeRefunds/getPaymentHistory', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchCollectionHistory(params);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const refundFeePayment = createAsyncThunk('feeRefunds/refundFeePayment', async ({ paymentId, refundAmount, refundReason }, { rejectWithValue }) => {
  try {
    const { data } = await api.refundFeePayment(paymentId, { refundAmount, refundReason });
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getFeeRefunds = createAsyncThunk('feeRefunds/getFeeRefunds', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchFeeRefunds(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getFeeRefund = createAsyncThunk('feeRefunds/getFeeRefund', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchFeeRefund(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const createFeeRefund = createAsyncThunk('feeRefunds/createFeeRefund', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.createFeeRefund(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const deleteFeeRefund = createAsyncThunk('feeRefunds/deleteFeeRefund', async (id, { rejectWithValue }) => {
  try {
    await api.deleteFeeRefund(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

const feeRefundSlice = createSlice({
  name: 'feeRefunds',
  initialState: {
    refunds: [],
    payments: [],
    currentRefund: null,
    loading: false,
    paymentsLoading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getFeeRefunds.pending, (state) => {
        state.loading = true;
      })
      .addCase(getFeeRefunds.fulfilled, (state, action) => {
        state.loading = false;
        state.refunds = action.payload.refunds;
      })
      .addCase(getFeeRefunds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(getFeeRefund.fulfilled, (state, action) => {
        state.currentRefund = action.payload;
      })
      .addCase(createFeeRefund.fulfilled, (state, action) => {
        state.refunds.unshift(action.payload);
      })
      .addCase(deleteFeeRefund.fulfilled, (state, action) => {
        state.refunds = state.refunds.filter((n) => n._id !== action.payload);
      })
      .addCase(getPaymentHistory.pending, (state) => { state.paymentsLoading = true; })
      .addCase(getPaymentHistory.fulfilled, (state, action) => {
        state.paymentsLoading = false;
        state.payments = action.payload.payments || [];
      })
      .addCase(getPaymentHistory.rejected, (state) => { state.paymentsLoading = false; })
      .addCase(refundFeePayment.fulfilled, (state, action) => {
        const refundedId = action.payload.refundedPayment?._id;
        if (refundedId) {
          state.payments = state.payments.map((p) =>
            p._id === refundedId ? { ...p, status: 'refunded' } : p
          );
        }
      });
  },
});

export const { clearError } = feeRefundSlice.actions;
export default feeRefundSlice.reducer;
