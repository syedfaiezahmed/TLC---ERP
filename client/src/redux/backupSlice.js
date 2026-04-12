import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const createBackup = createAsyncThunk('backup/createBackup', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.createBackup();
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const restoreBackup = createAsyncThunk('backup/restoreBackup', async ({ file, password, mode }, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append('backup', file);
    formData.append('password', password);
    formData.append('mode', mode);

    const { data } = await api.restoreBackup(formData);
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

const backupSlice = createSlice({
  name: 'backup',
  initialState: {
    message: null,
    loading: false,
    error: null,
  },
  reducers: {
      clearBackupMessage: (state) => {
          state.message = null;
          state.error = null;
      }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createBackup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBackup.fulfilled, (state) => {
        state.loading = false;
        // The backend sends the file as a download, handled by the browser or API service.
        // If the API service handles the blob download, we might not get here in the same way.
        // But if it returns metadata, we can show a success message.
        // Assuming api.createBackup handles the download trigger.
      })
      .addCase(createBackup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Backup failed';
      })
      .addCase(restoreBackup.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(restoreBackup.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload.message;
      })
      .addCase(restoreBackup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Restore failed';
      });
  },
});

export const { clearBackupMessage } = backupSlice.actions;
export default backupSlice.reducer;
