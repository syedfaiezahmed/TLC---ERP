import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getExpenseCategories = createAsyncThunk('expenseCategories/getCategories', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchExpenseCategories(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const createExpenseCategory = createAsyncThunk('expenseCategories/createCategory', async (categoryData, { rejectWithValue }) => {
  try {
    const { data } = await api.createExpenseCategory(categoryData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const deleteExpenseCategory = createAsyncThunk('expenseCategories/deleteCategory', async (id, { rejectWithValue }) => {
  try {
    await api.deleteExpenseCategory(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

const expenseCategorySlice = createSlice({
  name: 'expenseCategories',
  initialState: {
    categories: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearCategoryError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getExpenseCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(getExpenseCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(getExpenseCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createExpenseCategory.fulfilled, (state, action) => {
        state.categories.push(action.payload);
        state.categories.sort((a, b) => a.code.localeCompare(b.code));
      })
      .addCase(createExpenseCategory.rejected, (state, action) => {
        state.error = action.payload?.message;
      })
      .addCase(deleteExpenseCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter((c) => c._id !== action.payload);
      })
      .addCase(deleteExpenseCategory.rejected, (state, action) => {
        state.error = action.payload?.message;
      });
  },
});

export const { clearCategoryError } = expenseCategorySlice.actions;
export default expenseCategorySlice.reducer;
