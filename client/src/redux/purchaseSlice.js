import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getPurchases = createAsyncThunk('purchases/getPurchases', async ({ companyId, params }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchPurchases(companyId, params);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const createPurchase = createAsyncThunk('purchases/createPurchase', async (purchaseData, { rejectWithValue }) => {
  try {
    const { data } = await api.createPurchase(purchaseData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const recordTeacherPayment = createAsyncThunk('purchases/recordPayment', async ({ id, paymentData }, { rejectWithValue }) => {
  try {
    const { data } = await api.recordTeacherPayment(id, paymentData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const recordSupplierPayment = recordTeacherPayment;

export const updatePurchase = createAsyncThunk('purchases/updatePurchase', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.updatePurchase(id, payload);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const deletePurchasePayment = createAsyncThunk('purchases/deletePurchasePayment', async ({ purchaseId, paymentId }, { rejectWithValue }) => {
  try {
    const { data } = await api.deletePurchasePayment(purchaseId, paymentId);
    return { purchaseId, paymentId, data };
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const deletePurchase = createAsyncThunk('purchases/deletePurchase', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.deletePurchase(id);
    return { id, data };
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

const purchaseSlice = createSlice({
  name: 'purchases',
  initialState: {
    purchases: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getPurchases.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPurchases.fulfilled, (state, action) => {
        state.loading = false;
        state.purchases = action.payload.purchases;
      })
      .addCase(getPurchases.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createPurchase.fulfilled, (state, action) => {
        state.purchases.unshift(action.payload);
      })
      .addCase(recordSupplierPayment.fulfilled, (state, action) => {
        const index = state.purchases.findIndex(p => p._id === action.payload._id);
        if (index !== -1) {
            state.purchases[index] = action.payload;
        }
      })
      .addCase(updatePurchase.fulfilled, (state, action) => {
        const index = state.purchases.findIndex((p) => p._id === action.payload._id);
        if (index !== -1) state.purchases[index] = action.payload;
      })
      .addCase(deletePurchase.fulfilled, (state, action) => {
        state.purchases = state.purchases.filter((p) => p._id !== action.payload.id);
      })
      .addCase(deletePurchasePayment.fulfilled, (state, action) => {
        const { purchaseId, paymentId } = action.payload;
        const p = state.purchases.find(x => x._id === purchaseId);
        if (p && p.payments) p.payments = p.payments.filter(pm => pm._id !== paymentId);
      });
  },
});

export default purchaseSlice.reducer;
