import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getCourses = createAsyncThunk('courses/getCourses', async (companyId, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchCourses(companyId);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createCourse = createAsyncThunk('courses/createCourse', async (course, { rejectWithValue }) => {
  try {
    const { data } = await api.createCourse(course);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateCourse = createAsyncThunk('courses/updateCourse', async ({ id, course }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateCourse(id, course);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteCourse = createAsyncThunk('courses/deleteCourse', async (id, { rejectWithValue }) => {
  try {
    await api.deleteCourse(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const courseSlice = createSlice({
  name: 'courses',
  initialState: {
    courses: [],
    total: 0,
    page: 1,
    pages: 1,
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
      .addCase(getCourses.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCourses.fulfilled, (state, action) => {
        state.loading = false;
        state.courses = action.payload.courses;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
      })
      .addCase(getCourses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createCourse.fulfilled, (state, action) => {
        state.courses.push(action.payload);
      })
      .addCase(updateCourse.fulfilled, (state, action) => {
        state.courses = state.courses.map((p) => (p._id === action.payload._id ? action.payload : p));
      })
      .addCase(deleteCourse.fulfilled, (state, action) => {
        state.courses = state.courses.filter((p) => p._id !== action.payload);
      });
  },
});

export const { clearError } = courseSlice.actions;
export default courseSlice.reducer;
