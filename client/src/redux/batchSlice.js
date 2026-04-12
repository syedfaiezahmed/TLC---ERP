import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getBatches = createAsyncThunk('batches/getBatches', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchBatches(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createBatch = createAsyncThunk('batches/createBatch', async (batch, { rejectWithValue }) => {
  try {
    const { data } = await api.createBatch(batch);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateBatch = createAsyncThunk('batches/updateBatch', async ({ id, batch }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateBatch(id, batch);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteBatch = createAsyncThunk('batches/deleteBatch', async (id, { rejectWithValue }) => {
  try {
    await api.deleteBatch(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const batchSlice = createSlice({
  name: 'batches',
  initialState: {
    batches: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getBatches.pending, (state) => {
        state.loading = true;
      })
      .addCase(getBatches.fulfilled, (state, action) => {
        state.loading = false;
        state.batches = action.payload;
      })
      .addCase(getBatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createBatch.fulfilled, (state, action) => {
        state.batches.unshift(action.payload);
      })
      .addCase(updateBatch.fulfilled, (state, action) => {
        state.batches = state.batches.map((b) => (b._id === action.payload._id ? action.payload : b));
      })
      .addCase(deleteBatch.fulfilled, (state, action) => {
        state.batches = state.batches.filter((b) => b._id !== action.payload);
      });
  },
});

export const { clearError } = batchSlice.actions;
export default batchSlice.reducer;
