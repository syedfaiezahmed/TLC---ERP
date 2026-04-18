import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getGroups = createAsyncThunk('groups/getGroups', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchGroups(companyId);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message });
  }
});

export const createGroup = createAsyncThunk('groups/createGroup', async (group, { rejectWithValue }) => {
  try {
    const { data } = await api.createGroup(group);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message });
  }
});

export const updateGroup = createAsyncThunk('groups/updateGroup', async ({ id, group }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateGroup(id, group);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message });
  }
});

export const deleteGroup = createAsyncThunk('groups/deleteGroup', async (id, { rejectWithValue }) => {
  try {
    await api.deleteGroup(id);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message });
  }
});

export const seedGroups = createAsyncThunk('groups/seedGroups', async (companyId, { rejectWithValue, dispatch }) => {
  try {
    await api.seedDefaultGroups(companyId);
    // Reload groups after seeding
    const { data } = await api.fetchGroups(companyId);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message });
  }
});

const groupSlice = createSlice({
  name: 'groups',
  initialState: {
    groups: [],
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {
    clearGroupError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // getGroups
      .addCase(getGroups.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(getGroups.fulfilled, (state, action) => {
        state.loading = false;
        state.groups = action.payload.groups || [];
        state.total = action.payload.total || 0;
      })
      .addCase(getGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to load groups';
      })
      // createGroup
      .addCase(createGroup.fulfilled, (state, action) => {
        state.groups.push(action.payload);
        state.total += 1;
      })
      .addCase(createGroup.rejected, (state, action) => {
        state.error = action.payload?.message || 'Failed to create group';
      })
      // updateGroup
      .addCase(updateGroup.fulfilled, (state, action) => {
        state.groups = state.groups.map((g) => g._id === action.payload._id ? action.payload : g);
      })
      .addCase(updateGroup.rejected, (state, action) => {
        state.error = action.payload?.message || 'Failed to update group';
      })
      // deleteGroup
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.groups = state.groups.filter((g) => g._id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(deleteGroup.rejected, (state, action) => {
        state.error = action.payload?.message || 'Failed to delete group';
      })
      // seedGroups
      .addCase(seedGroups.pending, (state) => { state.loading = true; })
      .addCase(seedGroups.fulfilled, (state, action) => {
        state.loading = false;
        state.groups = action.payload.groups || [];
        state.total = action.payload.total || 0;
      })
      .addCase(seedGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to seed groups';
      });
  },
});

export const { clearGroupError } = groupSlice.actions;
export default groupSlice.reducer;
