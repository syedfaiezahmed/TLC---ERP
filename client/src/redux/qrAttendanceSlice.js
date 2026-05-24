import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const loadQRUsers = createAsyncThunk('qrAttendance/loadQRUsers',
  async ({ companyId, userType }, { rejectWithValue }) => {
    try { const { data } = await api.fetchQRUsers(companyId, userType); return data; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const generateQR = createAsyncThunk('qrAttendance/generateQR',
  async ({ userType, userId, companyId }, { rejectWithValue }) => {
    try { const { data } = await api.generateUserQR(userType, userId, companyId); return { userId, ...data }; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const scanQR = createAsyncThunk('qrAttendance/scanQR',
  async (payload, { rejectWithValue }) => {
    try { const { data } = await api.processQRScan(payload); return data; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const loadTodayScans = createAsyncThunk('qrAttendance/loadTodayScans',
  async (companyId, { rejectWithValue }) => {
    try { const { data } = await api.fetchTodayScans(companyId); return data; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const loadScanHistory = createAsyncThunk('qrAttendance/loadScanHistory',
  async ({ companyId, ...params }, { rejectWithValue }) => {
    try { const { data } = await api.fetchScanHistory(companyId, params); return data; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const loadDailySummary = createAsyncThunk('qrAttendance/loadDailySummary',
  async ({ companyId, date }, { rejectWithValue }) => {
    try { const { data } = await api.fetchQRDailySummary(companyId, date); return data; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const loadQRSettings = createAsyncThunk('qrAttendance/loadQRSettings',
  async (companyId, { rejectWithValue }) => {
    try { const { data } = await api.fetchQRSettings(companyId); return data; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const saveQRSettings = createAsyncThunk('qrAttendance/saveQRSettings',
  async ({ companyId, ...settingsData }, { rejectWithValue }) => {
    try { const { data } = await api.updateQRSettings(companyId, settingsData); return data; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

export const removeQRScan = createAsyncThunk('qrAttendance/removeQRScan',
  async (id, { rejectWithValue }) => {
    try { await api.deleteQRScan(id); return id; }
    catch (e) { return rejectWithValue(e.response?.data || { message: e.message }); }
  }
);

const qrAttendanceSlice = createSlice({
  name: 'qrAttendance',
  initialState: {
    users: [],
    todayScans: [],
    history: [],
    historyTotal: 0,
    summary: null,
    settings: null,
    lastScanResult: null,
    loadingUsers: false,
    loadingScans: false,
    loadingHistory: false,
    savingSettings: false,
    error: null,
  },
  reducers: {
    clearLastScan: (state) => { state.lastScanResult = null; },
    clearError: (state) => { state.error = null; },
    addTodayScan: (state, action) => {
      // Optimistic add / update for real-time feel
      const idx = state.todayScans.findIndex(s => s.userId === action.payload.userId);
      if (idx >= 0) state.todayScans[idx] = { ...state.todayScans[idx], ...action.payload };
      else state.todayScans.unshift(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // users
      .addCase(loadQRUsers.pending,    (s) => { s.loadingUsers = true; s.error = null; })
      .addCase(loadQRUsers.fulfilled,  (s, a) => { s.loadingUsers = false; s.users = a.payload; })
      .addCase(loadQRUsers.rejected,   (s, a) => { s.loadingUsers = false; s.error = a.payload?.message; })

      // generate QR — merge qrDataUrl into users list
      .addCase(generateQR.fulfilled,   (s, a) => {
        const idx = s.users.findIndex(u => u._id === a.payload.userId);
        if (idx >= 0) {
          s.users[idx].hasQR = true;
          s.users[idx].qrDataUrl = a.payload.qrDataUrl;
          s.users[idx].qrToken   = a.payload.token;
        }
      })

      // today scans
      .addCase(loadTodayScans.pending,   (s) => { s.loadingScans = true; })
      .addCase(loadTodayScans.fulfilled, (s, a) => { s.loadingScans = false; s.todayScans = a.payload; })
      .addCase(loadTodayScans.rejected,  (s, a) => { s.loadingScans = false; s.error = a.payload?.message; })

      // scan result
      .addCase(scanQR.fulfilled,  (s, a) => { s.lastScanResult = { ...a.payload, success: true }; })
      .addCase(scanQR.rejected,   (s, a) => { s.lastScanResult = { ...a.payload, success: false }; })

      // history
      .addCase(loadScanHistory.pending,   (s) => { s.loadingHistory = true; })
      .addCase(loadScanHistory.fulfilled, (s, a) => {
        s.loadingHistory = false;
        s.history = a.payload.scans;
        s.historyTotal = a.payload.total;
      })
      .addCase(loadScanHistory.rejected,  (s, a) => { s.loadingHistory = false; s.error = a.payload?.message; })

      // summary
      .addCase(loadDailySummary.fulfilled, (s, a) => { s.summary = a.payload; })

      // settings
      .addCase(loadQRSettings.fulfilled,  (s, a) => { s.settings = a.payload; })
      .addCase(saveQRSettings.pending,    (s) => { s.savingSettings = true; })
      .addCase(saveQRSettings.fulfilled,  (s, a) => { s.savingSettings = false; s.settings = a.payload; })
      .addCase(saveQRSettings.rejected,   (s, a) => { s.savingSettings = false; s.error = a.payload?.message; })

      // delete scan
      .addCase(removeQRScan.fulfilled, (s, a) => {
        s.todayScans = s.todayScans.filter(r => r._id !== a.payload);
        s.history    = s.history.filter(r => r._id !== a.payload);
      });
  },
});

export const { clearLastScan, clearError, addTodayScan } = qrAttendanceSlice.actions;
export default qrAttendanceSlice.reducer;
