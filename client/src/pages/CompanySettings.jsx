import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateCompany } from '../redux/companySlice';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  Alert,
  Divider,
  Avatar,
  Card,
  CardContent,
  useTheme,
  alpha,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import BusinessIcon from '@mui/icons-material/Business';
import EmailIcon from '@mui/icons-material/Email';
import LanguageIcon from '@mui/icons-material/Language';
import PhoneIcon from '@mui/icons-material/Phone';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const CompanySettings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { companyId } = useParams(); // Safe fallback
  const { selectedCompany, loading } = useSelector((state) => state.companies);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact: '',
    email: '',
    website: '',
    taxId: '',
    logo: '',
    currency: 'PKR'
  });

  const [message, setMessage] = useState(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (selectedCompany) {
      setFormData({
        name: selectedCompany.name || '',
        address: selectedCompany.address || '',
        contact: selectedCompany.contact || '',
        email: selectedCompany.email || '',
        website: selectedCompany.website || '',
        taxId: selectedCompany.taxId || '',
        logo: selectedCompany.logo || '',
        currency: selectedCompany.currency || 'PKR'
      });
    }
  }, [selectedCompany]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 5000000) { // 5MB limit check (though server allows 50MB)
              setMessage({ type: 'error', text: 'File size too large. Please upload an image smaller than 5MB.' });
              return;
          }
          
          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData({ ...formData, logo: reader.result });
              setLogoError(false);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleUploadClick = () => {
      fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = companyId || selectedCompany?._id;
    if (id) {
      try {
        await dispatch(updateCompany({ id: id, company: formData })).unwrap();
        setMessage({ type: 'success', text: 'Settings updated successfully!' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to update settings.' });
      }
    }
  };

  if (!selectedCompany && !companyId) {
      return (
        <Container maxWidth={false} sx={{ mt: 4 }}>
            <Alert severity="warning">Please select a company first.</Alert>
        </Container>
    )
  }

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
          <Typography variant="h4" fontWeight={800} gutterBottom sx={{ 
              color: 'text.primary',
              letterSpacing: -0.5
          }}>
            Company Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
              Update your company profile, contact information, and preferences.
          </Typography>
      </Box>

      {message && (
          <Alert 
            severity={message.type} 
            sx={{ 
                mb: 3, 
                borderRadius: 3,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                alignItems: 'center'
            }} 
            onClose={() => setMessage(null)}
          >
              {message.text}
          </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
            {/* Logo & Identity */}
            <Grid item xs={12} md={4}>
                <Card sx={{ 
                    height: '100%', 
                    borderRadius: 4, 
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)',
                    border: 'none',
                    position: 'relative',
                    overflow: 'visible'
                }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pt: 6, pb: 4 }}>
                        <Box 
                            sx={{ 
                                width: 120, 
                                height: 120, 
                                borderRadius: '50%', 
                                bgcolor: alpha(theme.palette.primary.main, 0.1), 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                mb: 3,
                                overflow: 'hidden',
                                boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
                                border: `4px solid ${theme.palette.background.paper}`
                            }}
                        >
                            {formData.logo && !logoError ? (
                                <img 
                                    src={formData.logo} 
                                    alt="Logo" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    onError={() => setLogoError(true)}
                                />
                            ) : (
                                <BusinessIcon sx={{ fontSize: 60, color: 'primary.main' }} />
                            )}
                        </Box>
                        
                        {/* File Upload Controls */}
                        <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <Button 
                            variant="outlined" 
                            size="small" 
                            startIcon={<CloudUploadIcon />}
                            onClick={handleUploadClick}
                            sx={{ mb: 2, borderRadius: 2, textTransform: 'none' }}
                        >
                            Upload Logo
                        </Button>

                        <Typography variant="h5" fontWeight={700} gutterBottom>
                            {formData.name || 'Company Name'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ bgcolor: 'grey.100', px: 2, py: 0.5, borderRadius: 2 }}>
                            {formData.email || 'email@example.com'}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            {/* Main Form */}
            <Grid item xs={12} md={8}>
                <Paper sx={{ 
                    p: 4, 
                    borderRadius: 4, 
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)',
                }}>
                    <Typography variant="h6" gutterBottom color="text.primary" fontWeight={700} mb={3} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box component="span" sx={{ width: 4, height: 24, bgcolor: 'primary.main', borderRadius: 1 }} />
                        Basic Information
                    </Typography>
                    
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                        <TextField
                            name="name"
                            label="Company Name"
                            fullWidth
                            value={formData.name}
                            onChange={handleChange}
                            required
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                        <TextField
                            name="email"
                            label="Email Address"
                            fullWidth
                            value={formData.email}
                            onChange={handleChange}
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                        <TextField
                            name="contact"
                            label="Contact Number"
                            fullWidth
                            value={formData.contact}
                            onChange={handleChange}
                            required
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                        <TextField
                            name="website"
                            label="Website"
                            fullWidth
                            value={formData.website}
                            onChange={handleChange}
                            placeholder="https://example.com"
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>

                        <Grid item xs={12}>
                        <TextField
                            name="address"
                            label="Address"
                            fullWidth
                            multiline
                            rows={2}
                            value={formData.address}
                            onChange={handleChange}
                            required
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>

                        <Grid item xs={12}>
                            <Divider sx={{ my: 3 }} />
                            <Typography variant="h6" gutterBottom color="text.primary" fontWeight={700} mb={3} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box component="span" sx={{ width: 4, height: 24, bgcolor: 'primary.main', borderRadius: 1 }} />
                                Invoicing & Tax
                            </Typography>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                        <TextField
                            name="taxId"
                            label="Tax ID / NTN / STRN"
                            fullWidth
                            value={formData.taxId}
                            onChange={handleChange}
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                        <TextField
                            name="currency"
                            label="Currency Symbol"
                            fullWidth
                            value={formData.currency}
                            onChange={handleChange}
                            variant="outlined"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <AttachMoneyIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>
                        <Grid item xs={12}>
                        <TextField
                            name="logo"
                            label="Logo URL"
                            fullWidth
                            value={formData.logo}
                            onChange={handleChange}
                            placeholder="https://example.com/logo.png"
                            helperText="Upload an image using the button above or provide a direct URL"
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                        </Grid>
                        
                        <Grid item xs={12} sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button 
                            type="submit" 
                            variant="contained" 
                            size="large" 
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                            disabled={loading}
                            sx={{ 
                                px: 5, 
                                py: 1.5, 
                                borderRadius: 3, 
                                textTransform: 'none', 
                                fontWeight: 600, 
                                fontSize: '1rem', 
                                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, 
                                boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.4)}`, 
                                '&:hover': {
                                    boxShadow: `0 12px 20px ${alpha(theme.palette.primary.main, 0.6)}`, 
                                }
                            }}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                        </Grid>
                    </Grid>
                </Paper>
            </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default CompanySettings;
