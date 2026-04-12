import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getAssets = createAsyncThunk('assets/getAssets', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchAssets(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getAssetById = createAsyncThunk('assets/getAssetById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchAssetById(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const createAsset = createAsyncThunk('assets/createAsset', async (assetData, { rejectWithValue }) => {
  try {
    const { data } = await api.createAsset(assetData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const updateAsset = createAsyncThunk('assets/updateAsset', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateAsset(id, payload);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const deleteAsset = createAsyncThunk('assets/deleteAsset', async (id, { rejectWithValue }) => {
  try {
    await api.deleteAsset(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getDepreciationHistory = createAsyncThunk('assets/getDepreciationHistory', async (assetId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchDepreciationHistory(assetId);
    return { assetId, records: data };
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const postDepreciation = createAsyncThunk('assets/postDepreciation', async ({ companyId, month }, { rejectWithValue }) => {
  try {
    const { data } = await api.postDepreciationForMonth(companyId, month);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

const assetSlice = createSlice({
  name: 'assets',
  initialState: {
    assets: [],
    selectedAsset: null,
    depreciationHistory: {},
    loading: false,
    depreciationLoading: false,
    error: null,
  },
  reducers: {
    clearSelectedAsset: (state) => { state.selectedAsset = null; },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAssets.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(getAssets.fulfilled, (state, action) => {
        state.loading = false;
        state.assets = action.payload;
      })
      .addCase(getAssets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(getAssetById.pending, (state) => { state.loading = true; })
      .addCase(getAssetById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedAsset = action.payload;
      })
      .addCase(getAssetById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createAsset.fulfilled, (state, action) => {
        state.assets.unshift(action.payload);
      })
      .addCase(updateAsset.fulfilled, (state, action) => {
        const idx = state.assets.findIndex((a) => a._id === action.payload._id);
        if (idx !== -1) state.assets[idx] = action.payload;
        if (state.selectedAsset?._id === action.payload._id) state.selectedAsset = action.payload;
      })
      .addCase(deleteAsset.fulfilled, (state, action) => {
        state.assets = state.assets.filter((a) => a._id !== action.payload);
      })
      .addCase(getDepreciationHistory.fulfilled, (state, action) => {
        state.depreciationHistory[action.payload.assetId] = action.payload.records;
      })
      .addCase(postDepreciation.pending, (state) => { state.depreciationLoading = true; })
      .addCase(postDepreciation.fulfilled, (state) => { state.depreciationLoading = false; })
      .addCase(postDepreciation.rejected, (state, action) => {
        state.depreciationLoading = false;
        state.error = action.payload?.message;
      });
  },
});

export const { clearSelectedAsset, clearError } = assetSlice.actions;
export default assetSlice.reducer;
