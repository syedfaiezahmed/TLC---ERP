import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getExpenses = createAsyncThunk('expenses/getExpenses', async ({ companyId, params }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchExpenses(companyId, params);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const createExpense = createAsyncThunk('expenses/createExpense', async (expenseData, { rejectWithValue }) => {
  try {
    const { data } = await api.createExpense(expenseData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const deleteExpense = createAsyncThunk('expenses/deleteExpense', async (id, { rejectWithValue }) => {
  try {
    await api.deleteExpense(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

const expenseSlice = createSlice({
  name: 'expenses',
  initialState: {
    expenses: [],
    totalAmount: 0,
    loading: false,
    saveLoading: false,
    error: null,
    saveError: null,
  },
  reducers: {
    clearExpenseError: (state) => {
      state.error = null;
      state.saveError = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getExpenses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getExpenses.fulfilled, (state, action) => {
        state.loading = false;
        state.expenses = action.payload.expenses || [];
        state.totalAmount = action.payload.totalAmount || 0;
      })
      .addCase(getExpenses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to load expenses';
      })
      .addCase(createExpense.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(createExpense.fulfilled, (state, action) => {
        state.saveLoading = false;
        state.saveError = null;
        state.expenses.unshift(action.payload);
        state.totalAmount += action.payload.amount || 0;
      })
      .addCase(createExpense.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload?.message || 'Failed to save expense';
      })
      .addCase(deleteExpense.fulfilled, (state, action) => {
        const removed = state.expenses.find(e => e._id === action.payload);
        if (removed) state.totalAmount -= removed.amount;
        state.expenses = state.expenses.filter((e) => e._id !== action.payload);
      })
      .addCase(deleteExpense.rejected, (state, action) => {
        state.error = action.payload?.message || 'Failed to delete expense';
      });
  },
});

export const { clearExpenseError } = expenseSlice.actions;
export default expenseSlice.reducer;
