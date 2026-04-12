import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getPurchaseReturns = createAsyncThunk('purchaseReturns/getPurchaseReturns', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchPurchaseReturns(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getPurchaseReturn = createAsyncThunk('purchaseReturns/getPurchaseReturn', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchPurchaseReturn(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const createPurchaseReturn = createAsyncThunk('purchaseReturns/createPurchaseReturn', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.createPurchaseReturn(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const deletePurchaseReturn = createAsyncThunk('purchaseReturns/deletePurchaseReturn', async (id, { rejectWithValue }) => {
  try {
    await api.deletePurchaseReturn(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

const purchaseReturnSlice = createSlice({
  name: 'purchaseReturns',
  initialState: {
    returns: [],
    currentReturn: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getPurchaseReturns.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPurchaseReturns.fulfilled, (state, action) => {
        state.loading = false;
        state.returns = action.payload.returns;
      })
      .addCase(getPurchaseReturns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(getPurchaseReturn.fulfilled, (state, action) => {
        state.currentReturn = action.payload;
      })
      .addCase(createPurchaseReturn.fulfilled, (state, action) => {
        state.returns.unshift(action.payload);
      })
      .addCase(deletePurchaseReturn.fulfilled, (state, action) => {
        state.returns = state.returns.filter((n) => n._id !== action.payload);
      });
  },
});

export const { clearError } = purchaseReturnSlice.actions;
export default purchaseReturnSlice.reducer;
