import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getAccounts = createAsyncThunk('accounts/getAccounts', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchAccounts(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: 'Failed to fetch accounts' });
  }
});

export const createAccount = createAsyncThunk('accounts/createAccount', async (accountData, { rejectWithValue }) => {
  try {
    const { data } = await api.createAccount(accountData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: 'Failed to create account' });
  }
});

export const updateAccount = createAsyncThunk('accounts/updateAccount', async ({ id, data: payload }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateAccount(id, payload);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: 'Failed to update account' });
  }
});

export const deleteAccount = createAsyncThunk('accounts/deleteAccount', async (id, { rejectWithValue }) => {
  try {
    await api.deleteAccount(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: 'Failed to delete account' });
  }
});

const accountSlice = createSlice({
  name: 'accounts',
  initialState: {
    accounts: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearAccountsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
      })
      .addCase(getAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch accounts';
      })
      .addCase(createAccount.fulfilled, (state, action) => {
        state.accounts.push(action.payload);
        state.accounts.sort((a, b) => a.code.localeCompare(b.code));
      })
      .addCase(createAccount.rejected, (state, action) => {
        state.error = action.payload?.message || 'Failed to create account';
      })
      .addCase(updateAccount.fulfilled, (state, action) => {
        const idx = state.accounts.findIndex((a) => a._id === action.payload._id);
        if (idx !== -1) state.accounts[idx] = action.payload;
        state.accounts.sort((a, b) => a.code.localeCompare(b.code));
      })
      .addCase(updateAccount.rejected, (state, action) => {
        state.error = action.payload?.message || 'Failed to update account';
      })
      .addCase(deleteAccount.fulfilled, (state, action) => {
        state.accounts = state.accounts.filter((a) => a._id !== action.payload);
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.error = action.payload?.message || 'Failed to delete account';
      });
  },
});

export const { clearAccountsError } = accountSlice.actions;
export default accountSlice.reducer;

