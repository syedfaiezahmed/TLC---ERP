import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const signin = createAsyncThunk('auth/signin', async (formData, { rejectWithValue }) => {
  try {
    const { data } = await api.signIn(formData);
    localStorage.setItem('profile', JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Signin Error:", error);
    const message = error.response?.data?.message || error.message || 'Login failed';
    return rejectWithValue({ message });
  }
});

export const signup = createAsyncThunk('auth/signup', async (formData, { rejectWithValue }) => {
  try {
    const { data } = await api.register(formData);
    localStorage.setItem('profile', JSON.stringify(data));
    return data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
    localStorage.removeItem('profile');
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    authData: localStorage.getItem('profile') ? JSON.parse(localStorage.getItem('profile')) : null,
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
      .addCase(signin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signin.fulfilled, (state, action) => {
        state.loading = false;
        state.authData = action.payload;
      })
      .addCase(signin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error?.message || 'Login failed';
      })
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        state.authData = action.payload;
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Registration failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.authData = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
