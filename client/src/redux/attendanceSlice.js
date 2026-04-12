import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getAttendance = createAsyncThunk('attendance/getAttendance', async (params, { rejectWithValue }) => {
  try { const { data } = await api.fetchAttendance(params); return data; }
  catch (error) { return rejectWithValue(error.response?.data || { message: error.message }); }
});

export const markAttendanceBulk = createAsyncThunk('attendance/markAttendanceBulk', async (payload, { rejectWithValue }) => {
  try { const { data } = await api.markAttendanceBulk(payload); return data; }
  catch (error) { return rejectWithValue(error.response?.data || { message: error.message }); }
});

export const deleteAttendanceRecord = createAsyncThunk('attendance/deleteAttendanceRecord', async (id, { rejectWithValue }) => {
  try { await api.deleteAttendance(id); return id; }
  catch (error) { return rejectWithValue(error.response?.data || { message: error.message }); }
});

export const getMonthlyRegister = createAsyncThunk('attendance/getMonthlyRegister', async (params, { rejectWithValue }) => {
  try { const { data } = await api.fetchMonthlyAttendanceRegister(params); return data; }
  catch (error) { return rejectWithValue(error.response?.data || { message: error.message }); }
});

export const getAttendanceReport = createAsyncThunk('attendance/getAttendanceReport', async (params, { rejectWithValue }) => {
  try { const { data } = await api.fetchAttendanceReport(params); return data; }
  catch (error) { return rejectWithValue(error.response?.data || { message: error.message }); }
});

export const getAttendanceStats = createAsyncThunk('attendance/getAttendanceStats', async (params, { rejectWithValue }) => {
  try { const { data } = await api.fetchAttendanceStats(params); return data; }
  catch (error) { return rejectWithValue(error.response?.data || { message: error.message }); }
});

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState: {
    records: [],
    stats: [],
    monthlyRegister: null,
    report: [],
    loading: false,
    loadingRegister: false,
    loadingReport: false,
    saving: false,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearRegister: (state) => { state.monthlyRegister = null; },
    clearReport: (state) => { state.report = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAttendance.pending,  (state) => { state.loading = true; state.error = null; })
      .addCase(getAttendance.fulfilled,(state, action) => { state.loading = false; state.records = action.payload; })
      .addCase(getAttendance.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message; })

      .addCase(markAttendanceBulk.pending,  (state) => { state.saving = true; state.error = null; })
      .addCase(markAttendanceBulk.fulfilled,(state) => { state.saving = false; })
      .addCase(markAttendanceBulk.rejected, (state, action) => { state.saving = false; state.error = action.payload?.message; })

      .addCase(deleteAttendanceRecord.fulfilled,(state, action) => {
        state.records = state.records.filter(r => r._id !== action.payload);
      })

      .addCase(getMonthlyRegister.pending,  (state) => { state.loadingRegister = true; state.error = null; })
      .addCase(getMonthlyRegister.fulfilled,(state, action) => { state.loadingRegister = false; state.monthlyRegister = action.payload; })
      .addCase(getMonthlyRegister.rejected, (state, action) => { state.loadingRegister = false; state.error = action.payload?.message; })

      .addCase(getAttendanceReport.pending,  (state) => { state.loadingReport = true; state.error = null; })
      .addCase(getAttendanceReport.fulfilled,(state, action) => { state.loadingReport = false; state.report = action.payload; })
      .addCase(getAttendanceReport.rejected, (state, action) => { state.loadingReport = false; state.error = action.payload?.message; })

      .addCase(getAttendanceStats.fulfilled, (state, action) => { state.stats = action.payload; });
  },
});

export const { clearError, clearRegister, clearReport } = attendanceSlice.actions;
export default attendanceSlice.reducer;
