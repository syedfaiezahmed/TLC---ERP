// Single-company mode: slim slice with only the two thunks actually used by the app.
//   • fetchCurrentCompany  – loads the logged-in user's company (for Settings / Navbar).
//   • updateCompany        – persists Settings page changes.
// Removed (dead code): getCompanies, createCompany, deleteCompany, selectCompany reducer.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const fetchCurrentCompany = createAsyncThunk(
  'companies/fetchCurrentCompany',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.fetchCompanyById(id);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const updateCompany = createAsyncThunk(
  'companies/updateCompany',
  async ({ id, company }, { rejectWithValue }) => {
    try {
      const { data } = await api.updateCompany(id, company);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

const companySlice = createSlice({
  name: 'companies',
  initialState: {
    loading: false,
    error: null,
    selectedCompany: null, // the single active company (user's own)
    // Kept for backward compatibility with any lingering `useSelector(s => s.companies.companies)`.
    // Always contains [selectedCompany] when loaded, or [] otherwise.
    companies: [],
  },
  reducers: {
    // Back-compat no-op: old code dispatched selectCompany(id) from URL params.
    // In single-company mode we ignore the id — selectedCompany is loaded via fetchCurrentCompany.
    selectCompany: (state) => state,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentCompany.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCompany = action.payload;
        state.companies = action.payload ? [action.payload] : [];
      })
      .addCase(fetchCurrentCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.selectedCompany = action.payload;
        state.companies = [action.payload];
      });
  },
});

export const { selectCompany } = companySlice.actions;
export default companySlice.reducer;
