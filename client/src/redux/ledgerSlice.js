import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const getLedger = createAsyncThunk('ledger/getLedger', async ({ companyId, page, limit, startDate, endDate, accountName, customerId, search, type }, { rejectWithValue }) => {
  try {
    const { data } = await api.fetchLedger(companyId, page, limit, startDate, endDate, accountName, customerId, search, type);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createLedgerEntry = createAsyncThunk('ledger/createLedgerEntry', async (entry, { rejectWithValue }) => {
  try {
    const { data } = await api.createLedgerEntry(entry);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const createJournalEntry = createAsyncThunk('ledger/createJournalEntry', async (journal, { rejectWithValue }) => {
  try {
    const { data } = await api.createJournalEntry(journal);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const updateLedgerEntry = createAsyncThunk('ledger/updateLedgerEntry', async ({ id, entry }, { rejectWithValue }) => {
  try {
    const { data } = await api.updateLedgerEntry(id, entry);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const deleteLedgerEntry = createAsyncThunk('ledger/deleteLedgerEntry', async (id, { rejectWithValue }) => {
  try {
    await api.deleteLedgerEntry(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const ledgerSlice = createSlice({
  name: 'ledger',
  initialState: {
    entries: [],
    page: 1,
    pages: 1,
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getLedger.pending, (state) => {
        state.loading = true;
      })
      .addCase(getLedger.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = action.payload.entries;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
        state.total = action.payload.total;
      })
      .addCase(getLedger.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error?.message;
      })
      .addCase(createLedgerEntry.pending, (state) => {
        state.loading = true;
      })
      .addCase(createLedgerEntry.fulfilled, (state, action) => {
        state.loading = false;
        state.entries.push(action.payload);
        state.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      })
      .addCase(createLedgerEntry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error?.message;
      })
      .addCase(createJournalEntry.pending, (state) => {
        state.loading = true;
      })
      .addCase(createJournalEntry.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(createJournalEntry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error?.message;
      })
      .addCase(updateLedgerEntry.fulfilled, (state, action) => {
        state.entries = state.entries.map((e) => (e._id === action.payload._id ? action.payload : e));
      })
      .addCase(deleteLedgerEntry.fulfilled, (state, action) => {
        state.entries = state.entries.filter((e) => e._id !== action.payload);
      });
  },
});

export default ledgerSlice.reducer;
