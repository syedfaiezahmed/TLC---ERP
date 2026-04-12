import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getEnquiries = createAsyncThunk('enquiries/getEnquiries', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchEnquiries();
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createEnquiry = createAsyncThunk('enquiries/createEnquiry', async (enquiry, { rejectWithValue }) => {
  try {
    const { data } = await api.createEnquiry(enquiry);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateEnquiry = createAsyncThunk('enquiries/updateEnquiry', async ({ id, enquiry }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateEnquiry(id, enquiry);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteEnquiry = createAsyncThunk('enquiries/deleteEnquiry', async (id, { rejectWithValue }) => {
  try {
    await api.deleteEnquiry(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const enquirySlice = createSlice({
  name: 'enquiries',
  initialState: {
    enquiries: [],
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
      .addCase(getEnquiries.pending, (state) => {
        state.loading = true;
      })
      .addCase(getEnquiries.fulfilled, (state, action) => {
        state.loading = false;
        state.enquiries = action.payload;
      })
      .addCase(getEnquiries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createEnquiry.fulfilled, (state, action) => {
        state.enquiries.unshift(action.payload);
      })
      .addCase(updateEnquiry.fulfilled, (state, action) => {
        state.enquiries = state.enquiries.map((e) => (e._id === action.payload._id ? action.payload : e));
      })
      .addCase(deleteEnquiry.fulfilled, (state, action) => {
        state.enquiries = state.enquiries.filter((e) => e._id !== action.payload);
      });
  },
});

export const { clearError } = enquirySlice.actions;
export default enquirySlice.reducer;
