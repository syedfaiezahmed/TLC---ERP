import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getStudents = createAsyncThunk('students/getStudents', async ({ companyId, page, limit, search }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchStudents(companyId, { page, limit, search });
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const createStudent = createAsyncThunk('students/createStudent', async (student, { rejectWithValue }) => {
  try {
    const { data } = await api.createStudent(student);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateStudent = createAsyncThunk('students/updateStudent', async ({ id, student }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateStudent(id, student);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteStudent = createAsyncThunk('students/deleteStudent', async (id, { rejectWithValue }) => {
  try {
    await api.deleteStudent(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const studentSlice = createSlice({
  name: 'students',
  initialState: {
    students: [],
    total: 0,
    page: 1,
    pages: 1,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getStudents.pending, (state) => {
        state.loading = true;
      })
      .addCase(getStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.students = action.payload.students;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
      })
      .addCase(getStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createStudent.fulfilled, (state, action) => {
        state.students.push(action.payload);
      })
      .addCase(updateStudent.fulfilled, (state, action) => {
        state.students = state.students.map((c) => (c._id === action.payload._id ? action.payload : c));
      })
      .addCase(deleteStudent.fulfilled, (state, action) => {
        state.students = state.students.filter((c) => c._id !== action.payload);
      });
  },
});

export default studentSlice.reducer;
