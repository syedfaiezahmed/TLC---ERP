import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getCompanies = createAsyncThunk('companies/getCompanies', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchCompanies();
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createCompany = createAsyncThunk('companies/createCompany', async (company, { rejectWithValue }) => {
  try {
    const { data } = await api.createCompany(company);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateCompany = createAsyncThunk('companies/updateCompany', async ({ id, company }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateCompany(id, company);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteCompany = createAsyncThunk('companies/deleteCompany', async (id, { rejectWithValue }) => {
  try {
    await api.deleteCompany(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const companySlice = createSlice({
  name: 'companies',
  initialState: {
    companies: [],
    loading: false,
    error: null,
    selectedCompany: null,
  },
  reducers: {
    selectCompany: (state, action) => {
        state.selectedCompany = state.companies.find(c => c._id === action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCompanies.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCompanies.fulfilled, (state, action) => {
        state.loading = false;
        state.companies = action.payload;
      })
      .addCase(getCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createCompany.fulfilled, (state, action) => {
        // Handle SaaS creation response which includes admin details
        const newCompany = action.payload.company || action.payload;
        state.companies.push(newCompany);
        
        if (action.payload.admin) {
            // Logic to show admin credentials to superadmin
            alert(`Company Created!\n\nAdmin Email: ${action.payload.admin.email}\nCompany ID: ${action.payload.admin.companyId}\n\nPlease share these with the client.`);
        }
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.companies = state.companies.map((c) => (c._id === action.payload._id ? action.payload : c));
        if (state.selectedCompany && state.selectedCompany._id === action.payload._id) {
            state.selectedCompany = action.payload;
        }
      })
      .addCase(deleteCompany.fulfilled, (state, action) => {
        state.companies = state.companies.filter((c) => c._id !== action.payload);
        if (state.selectedCompany?._id === action.payload) {
            state.selectedCompany = null;
        }
      });
  },
});

export const { selectCompany } = companySlice.actions;
export default companySlice.reducer;
