import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchEnrollments = createAsyncThunk(
  'enrollments/fetchEnrollments',
  async (params, { rejectWithValue }) => {
    try {
      const { companyId, ...queryParams } = params || {};
      const res = await api.fetchEnrollmentsByCompany(companyId, queryParams);
      return res.data;
    } catch (e) {
      return rejectWithValue(e.response?.data || { message: e.message });
    }
  }
);

export const fetchStudentEnrollments = createAsyncThunk(
  'enrollments/fetchStudentEnrollments',
  async (studentId, { rejectWithValue }) => {
    try {
      const res = await api.fetchStudentEnrollments(studentId);
      return res.data;
    } catch (e) {
      return rejectWithValue(e.response?.data || { message: e.message });
    }
  }
);

export const createEnrollment = createAsyncThunk(
  'enrollments/createEnrollment',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.createEnrollment(data);
      return res.data;
    } catch (e) {
      return rejectWithValue(e.response?.data || { message: e.message });
    }
  }
);

export const updateEnrollment = createAsyncThunk(
  'enrollments/updateEnrollment',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.updateEnrollment(id, data);
      return res.data;
    } catch (e) {
      return rejectWithValue(e.response?.data || { message: e.message });
    }
  }
);

export const deleteEnrollment = createAsyncThunk(
  'enrollments/deleteEnrollment',
  async (id, { rejectWithValue }) => {
    try {
      await api.deleteEnrollment(id);
      return id;
    } catch (e) {
      return rejectWithValue(e.response?.data || { message: e.message });
    }
  }
);

export const fetchEnrollmentStatistics = createAsyncThunk(
  'enrollments/fetchEnrollmentStatistics',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try {
      const res = await api.fetchEnrollmentStatistics(companyId, params);
      return res.data;
    } catch (e) {
      return rejectWithValue(e.response?.data || { message: e.message });
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const enrollmentSlice = createSlice({
  name: 'enrollments',
  initialState: {
    enrollments: [],
    studentEnrollments: [],
    statistics: null,
    pagination: { page: 1, pages: 1, total: 0 },
    loading: {},
    errors: {},
    successMessage: null,
  },
  reducers: {
    clearSuccess: (state) => { state.successMessage = null; },
    clearError: (state, action) => { delete state.errors[action.payload]; },
    clearStudentEnrollments: (state) => { state.studentEnrollments = []; },
  },
  extraReducers: (builder) => {
    const handle = (thunk, key, onFulfilled) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.loading[key] = true;
          delete state.errors[key];
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key] = false;
          onFulfilled(state, action);
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading[key] = false;
          state.errors[key] = action.payload?.message || 'An error occurred';
        });
    };

    handle(fetchEnrollments, 'enrollments', (state, action) => {
      state.enrollments = action.payload.enrollments || [];
      state.pagination = {
        page: action.payload.page || 1,
        pages: action.payload.pages || 1,
        total: action.payload.total || 0,
      };
    });

    handle(fetchStudentEnrollments, 'studentEnrollments', (state, action) => {
      state.studentEnrollments = action.payload || [];
    });

    handle(createEnrollment, 'createEnrollment', (state, action) => {
      state.enrollments.unshift(action.payload);
      state.successMessage = 'Enrollment created successfully';
    });

    handle(updateEnrollment, 'updateEnrollment', (state, action) => {
      const updated = action.payload;
      const idx = state.enrollments.findIndex(e => e._id === updated._id);
      if (idx !== -1) state.enrollments[idx] = updated;
      state.successMessage = 'Enrollment updated successfully';
    });

    handle(deleteEnrollment, 'deleteEnrollment', (state, action) => {
      state.enrollments = state.enrollments.filter(e => e._id !== action.payload);
      state.successMessage = 'Enrollment deleted successfully';
    });

    handle(fetchEnrollmentStatistics, 'statistics', (state, action) => {
      state.statistics = action.payload;
    });
  }
});

export const { clearSuccess, clearError, clearStudentEnrollments } = enrollmentSlice.actions;
export default enrollmentSlice.reducer;
