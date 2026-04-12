import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getExams = createAsyncThunk('exams/getExams', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchExams();
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const getExamById = createAsyncThunk('exams/getExamById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchExam(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createExam = createAsyncThunk('exams/createExam', async (exam, { rejectWithValue }) => {
  try {
    const { data } = await api.createExam(exam);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateExam = createAsyncThunk('exams/updateExam', async ({ id, exam }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateExam(id, exam);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteExam = createAsyncThunk('exams/deleteExam', async (id, { rejectWithValue }) => {
  try {
    await api.deleteExam(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const saveExamResults = createAsyncThunk('exams/saveResults', async ({ id, results }, { rejectWithValue }) => {
  try {
    const { data } = await api.saveExamResults(id, results);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const examSlice = createSlice({
  name: 'exams',
  initialState: {
    exams: [],
    currentExam: null,
    currentResults: [],
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
      .addCase(getExams.pending, (state) => {
        state.loading = true;
      })
      .addCase(getExams.fulfilled, (state, action) => {
        state.loading = false;
        state.exams = action.payload;
      })
      .addCase(getExams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message;
      })
      .addCase(getExamById.fulfilled, (state, action) => {
        state.currentExam = action.payload.exam;
        state.currentResults = action.payload.results;
      })
      .addCase(createExam.fulfilled, (state, action) => {
        state.exams.unshift(action.payload);
      })
      .addCase(updateExam.fulfilled, (state, action) => {
        state.exams = state.exams.map((e) => (e._id === action.payload._id ? action.payload : e));
      })
      .addCase(deleteExam.fulfilled, (state, action) => {
        state.exams = state.exams.filter((e) => e._id !== action.payload);
      });
  },
});

export const { clearError } = examSlice.actions;
export default examSlice.reducer;
