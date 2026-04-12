import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getTeachers = createAsyncThunk('teachers/getTeachers', async ({ companyId, params }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchTeachers(companyId, params);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createTeacher = createAsyncThunk('teachers/createTeacher', async (teacherData, { rejectWithValue }) => {
  try {
    const { data } = await api.createTeacher(teacherData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateTeacher = createAsyncThunk('teachers/updateTeacher', async ({ id, teacherData }, { rejectWithValue }) => {
    try {
        const { data } = await api.updateTeacher(id, teacherData);
        return data;
    } catch (error) {
        return rejectWithValue(error.response.data);
    }
});

export const deleteTeacher = createAsyncThunk('teachers/deleteTeacher', async (id, { rejectWithValue }) => {
    try {
        await api.deleteTeacher(id);
        return id;
    } catch (error) {
        return rejectWithValue(error.response.data);
    }
});

const teacherSlice = createSlice({
  name: 'teachers',
  initialState: {
    teachers: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getTeachers.pending, (state) => {
        state.loading = true;
      })
      .addCase(getTeachers.fulfilled, (state, action) => {
        state.loading = false;
        state.teachers = action.payload.teachers;
      })
      .addCase(getTeachers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(createTeacher.fulfilled, (state, action) => {
        state.teachers.push(action.payload);
      })
      .addCase(updateTeacher.fulfilled, (state, action) => {
          state.teachers = state.teachers.map((t) => (t._id === action.payload._id ? action.payload : t));
      })
      .addCase(deleteTeacher.fulfilled, (state, action) => {
          state.teachers = state.teachers.filter((t) => t._id !== action.payload);
      });
  },
});

export default teacherSlice.reducer;
