import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getFees = createAsyncThunk('fees/getFees', async ({ companyId, page, limit, search, status, startDate, endDate }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchFees(companyId, page, limit, search, status, startDate, endDate);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getFee = createAsyncThunk('fees/getFee', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchFee(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createFee = createAsyncThunk('fees/createFee', async (fee, { rejectWithValue }) => {
  try {
    const { data } = await api.createFee(fee);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateFee = createAsyncThunk('fees/updateFee', async ({ id, fee }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateFee(id, fee);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteFee = createAsyncThunk('fees/deleteFee', async (id, { rejectWithValue }) => {
  try {
    await api.deleteFee(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const recordPayment = createAsyncThunk('fees/recordPayment', async ({ id, paymentData }, { rejectWithValue }) => {
    try {
        const { data } = await api.recordPayment(id, paymentData);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

export const recordGenericPayment = createAsyncThunk('fees/recordGenericPayment', async ({ studentId, paymentData }, { rejectWithValue }) => {
    try {
        const { data } = await api.recordGenericPayment(studentId, paymentData);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data || { message: error.message });
    }
});

const feeSlice = createSlice({
  name: 'fees',
  initialState: {
    fees: [],
    page: 1,
    pages: 1,
    total: 0,
    summary: {
        totalInvoiced: 0,
        totalPaid: 0,
        totalDue: 0
    },
    currentFee: null,
    loading: false,
    error: null,
  },
  reducers: {
      clearCurrentFee: (state) => {
          state.currentFee = null;
      }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getFees.pending, (state) => {
        state.loading = true;
      })
      .addCase(getFees.fulfilled, (state, action) => {
        state.loading = false;
        state.fees = action.payload.fees;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
        state.total = action.payload.total;
        state.summary = action.payload.summary || { totalInvoiced: 0, totalPaid: 0, totalDue: 0 };
      })
      .addCase(getFees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(getFee.pending, (state) => {
          state.loading = true;
      })
      .addCase(getFee.fulfilled, (state, action) => {
          state.loading = false;
          state.currentFee = action.payload;
      })
      .addCase(createFee.fulfilled, (state, action) => {
        state.fees.unshift(action.payload);
      })
      .addCase(updateFee.fulfilled, (state, action) => {
        state.fees = state.fees.map((i) => (i._id === action.payload._id ? action.payload : i));
        state.currentFee = action.payload;
      })
      .addCase(deleteFee.fulfilled, (state, action) => {
        state.fees = state.fees.filter((i) => i._id !== action.payload);
      })
      .addCase(recordPayment.fulfilled, (state, action) => {
          if (state.currentFee && state.currentFee._id === action.payload._id) {
              state.currentFee = action.payload;
          }
          state.fees = state.fees.map((i) => (i._id === action.payload._id ? action.payload : i));
      });
  },
});

export const { clearCurrentFee } = feeSlice.actions;
export default feeSlice.reducer;
