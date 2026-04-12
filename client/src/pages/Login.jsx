import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { signin, clearError } from '../redux/authSlice';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Grid,
  useTheme,
  InputAdornment,
  alpha // Import alpha
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '', companyId: '' });
  const [loginError, setLoginError] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { authData, loading, error } = useSelector((state) => state.auth);
  const theme = useTheme();

  useEffect(() => {
    if (authData) {
      if (authData.company) {
        navigate(`/company/${authData.company}/dashboard`);
      } else {
        // Fallback for unexpected state, though company should be linked by seeder
        navigate('/login');
      }
    }
    return () => {
        dispatch(clearError());
    }
  }, [authData, navigate, dispatch]);

  useEffect(() => {
    if (error) {
      setLoginError(error);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    
    try {
      const result = await dispatch(signin(formData)).unwrap();
      console.log('Login successful:', result);
    } catch (err) {
      console.error('Login failed:', err);
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <Grid container component="main" sx={{ height: '100vh', overflow: 'hidden' }}>
        {/* Left Side - Brand / Image */}
        <Grid
            item
            xs={false}
            sm={4}
            md={7}
            lg={8}
            sx={{
                bgcolor: 'primary.main',
                position: 'relative',
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                p: 4,
                overflow: 'hidden'
            }}
        >
            {/* Abstract Background Shapes */}
            <Box sx={{ 
                position: 'absolute', 
                top: '-10%', 
                left: '-10%', 
                width: '60%', 
                height: '60%', 
                borderRadius: '50%', 
                bgcolor: 'rgba(255,255,255,0.05)',
                filter: 'blur(80px)',
                zIndex: 0
            }} />
            <Box sx={{ 
                position: 'absolute', 
                bottom: '-10%', 
                right: '-10%', 
                width: '50%', 
                height: '50%', 
                borderRadius: '50%', 
                bgcolor: 'rgba(0,0,0,0.05)',
                filter: 'blur(60px)',
                zIndex: 0
            }} />
            
            <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 480 }}>
                <Box 
                  sx={{ 
                    width: 100, 
                    height: 100, 
                    borderRadius: '24px', 
                    bgcolor: 'white', 
                    mx: 'auto', 
                    mb: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                  }}
                >
                  <img 
                    src="/logo.png" 
                    alt="TLC Logo" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentNode.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';
                    }}
                  />
                </Box>
                <Typography variant="h2" component="h1" fontWeight={800} gutterBottom sx={{ letterSpacing: '-0.04em' }}>
                    TLC ERP
                </Typography>
                <Typography variant="h5" sx={{ mb: 4, fontWeight: 700, color: alpha('#FFFFFF', 0.9), letterSpacing: '0.02em' }}>
                    Upgrade Your Concepts
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.8, fontWeight: 500, lineHeight: 1.7, px: 4 }}>
                    The complete institutional suite for modern education management and real-time analytics.
                </Typography>
            </Box>
        </Grid>

        {/* Right Side - Login Form */}
        <Grid 
            item 
            xs={12} 
            sm={8} 
            md={5} 
            lg={4} 
            component={Paper} 
            elevation={0} 
            square 
            sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.paper'
            }}
        >
            <Box
                sx={{
                    my: 8,
                    mx: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    maxWidth: 400,
                    width: '100%'
                }}
            >
                 <Box sx={{ 
                     width: 56, 
                     height: 56, 
                     borderRadius: 2, 
                     bgcolor: alpha(theme.palette.primary.main, 0.1), 
                     display: 'flex', 
                     alignItems: 'center', 
                     justifyContent: 'center',
                     mb: 3
                 }}>
                    <LockOutlinedIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                 </Box>
                 <Typography component="h1" variant="h4" fontWeight={800} sx={{ color: 'text.primary', mb: 1, letterSpacing: -0.5 }}>
                    Welcome Back
                 </Typography>
                 <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
                    Please enter your credentials to sign in.
                 </Typography>

                {loginError && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 2, width: '100%' }}>
                        {loginError}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email Address"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        value={formData.email}
                        onChange={handleChange}
                        variant="outlined"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <EmailIcon color="action" />
                                </InputAdornment>
                            ),
                            sx: { fontSize: '1rem', borderRadius: 3 }
                        }}
                    />
                    {/* Multi-vendor companyId hidden as per single-account instruction */}
                    {false && (
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="companyId"
                            label="Company ID"
                            name="companyId"
                            placeholder="Enter your Company ID"
                            value={formData.companyId}
                            onChange={handleChange}
                            variant="outlined"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <BusinessIcon color="action" />
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '1rem', borderRadius: 3 }
                            }}
                        />
                    )}
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={formData.password}
                        onChange={handleChange}
                        variant="outlined"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LockOutlinedIcon color="action" />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 3 }
                        }}
                        sx={{ mb: 4 }}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
                        sx={{ 
                            py: 1.5, 
                            fontSize: '1rem',
                            textTransform: 'none',
                            borderRadius: 4,
                            fontWeight: 700,
                            boxShadow: 'none',
                            '&:hover': {
                                boxShadow: 'none'
                            }
                        }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                    </Button>
                    <Box sx={{ mt: 8, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled">
                            &copy; {new Date().getFullYear()} TLC ERP. All rights reserved.
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Grid>
    </Grid>
  );
};

export default Login;