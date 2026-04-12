import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { restoreBackup, clearBackupMessage } from '../redux/backupSlice';
import {
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Box,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SecurityIcon from '@mui/icons-material/Security';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import * as api from '../services/api';

const Backup = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { loading, message, error } = useSelector((state) => state.backup);
  
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('merge'); // 'merge' or 'overwrite'

  const handleBackup = async () => {
      try {
          // Direct call to API to handle download
          const response = await api.createBackup(password || null);
          
          // Create a blob from the response data
          // The backend returns a JSON object { data: "encrypted_string", iv: "..." } or similar
          // We want to save this JSON as a file.
          const jsonString = JSON.stringify(response.data, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `backup-${new Date().toISOString().slice(0, 10)}.json`);
          document.body.appendChild(link);
          link.click();
          link.parentNode.removeChild(link);
      } catch (err) {
          console.error('Backup failed:', err);
          alert('Backup failed to download');
      }
  };

  const handleFileChange = (e) => {
      setFile(e.target.files[0]);
  };

  const handleRestore = (e) => {
      e.preventDefault();
      if (!file) {
          alert("Please select a file.");
          return;
      }
      dispatch(restoreBackup({ file, password, mode }));
  };

  const loadHistory = async () => {
      try {
          const companyId = localStorage.getItem('currentCompanyId');
          if (!companyId) return;
          const { data } = await api.getBackupHistory(companyId);
          setHistory(data);
      } catch (err) {
          console.error('History load failed:', err);
      }
  };

  React.useEffect(() => {
      loadHistory();
  }, []);

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom fontWeight={800} sx={{ 
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, 
            backgroundClip: 'text', 
            textFillColor: 'transparent',
            letterSpacing: -0.5
        }}>
          System Backup & Restore
        </Typography>
        <Typography variant="body1" color="text.secondary" fontWeight={500}>
          Manage your data security with encrypted backups and restoration tools.
        </Typography>
      </Box>

      {message && <Alert severity="success" onClose={() => dispatch(clearBackupMessage())} sx={{ mb: 3, borderRadius: 3 }}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => dispatch(clearBackupMessage())} sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      <Grid container spacing={4}>
        {/* Export Section */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
              height: '100%', 
              borderRadius: 4, 
              boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)',
              transition: 'transform 0.2s',
              '&:hover': {
                  transform: 'translateY(-4px)'
              }
          }}>
            <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" mb={2}>
                    <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 3, 
                        bgcolor: alpha(theme.palette.primary.main, 0.1), 
                        color: theme.palette.primary.main,
                        mr: 2
                    }}>
                        <BackupIcon fontSize="large" />
                    </Box>
                    <Typography variant="h5" fontWeight={700}>
                        Export Backup
                    </Typography>
                </Box>
              
                <Typography variant="body2" color="text.secondary" paragraph sx={{ minHeight: 60 }}>
                    Create a secure, encrypted JSON backup of all your data (Companies, Customers, Invoices, Ledger).
                    The file will be encrypted with AES-256 for maximum security.
                </Typography>

                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    <Typography variant="body2">
                        Keep your backup file and password safe. You will need the password to restore this data later.
                    </Typography>
                </Alert>

                <Box sx={{ mt: 4 }}>
                    {/* Password optional: leave blank to use server secret */}
                    {/* Removed required to allow no-password flow */}
                    {/* Keeping field for users who want their own password */}
                    <TextField
                        label="Backup Password (optional)"
                        type="password"
                        fullWidth
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Button 
                        variant="contained" 
                        color="primary" 
                        size="large"
                        startIcon={<CloudDownloadIcon />}
                        onClick={handleBackup}
                        fullWidth
                        sx={{ 
                            py: 1.5, 
                            borderRadius: 3,
                            fontWeight: 600,
                            textTransform: 'none',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                        }}
                    >
                        Download Encrypted Backup
                    </Button>
                </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Restore Section */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
              height: '100%', 
              borderRadius: 4, 
              boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)',
              transition: 'transform 0.2s',
              '&:hover': {
                  transform: 'translateY(-4px)'
              }
          }}>
            <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" mb={2}>
                    <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 3, 
                        bgcolor: alpha(theme.palette.secondary.main, 0.1), 
                        color: theme.palette.secondary.main,
                        mr: 2
                    }}>
                        <RestoreIcon fontSize="large" />
                    </Box>
                    <Typography variant="h5" fontWeight={700}>
                        Restore Backup
                    </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" paragraph>
                    Restore data from a previously downloaded backup file. You must provide the correct decryption password.
                </Typography>

                <form onSubmit={handleRestore}>
                    <Stack spacing={3}>
                        <Box 
                            sx={{ 
                                border: '2px dashed', 
                                borderColor: file ? 'primary.main' : 'divider', 
                                borderRadius: 3, 
                                p: 3, 
                                textAlign: 'center',
                                bgcolor: file ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                                    borderColor: 'primary.main'
                                }
                            }}
                            component="label"
                            htmlFor="raised-button-file"
                        >
                            <input
                                accept=".json"
                                style={{ display: 'none' }}
                                id="raised-button-file"
                                type="file"
                                onChange={handleFileChange}
                            />
                            <AttachFileIcon color={file ? "primary" : "action"} sx={{ mb: 1, fontSize: 40 }} />
                            <Typography variant="body1" fontWeight={600} color={file ? "primary" : "text.secondary"}>
                                {file ? file.name : 'Click to Select Backup File'}
                            </Typography>
                            {!file && <Typography variant="caption" color="text.secondary">Supported format: .json</Typography>}
                        </Box>

                        <TextField
                            label="Decryption Password (optional)"
                            type="password"
                            fullWidth
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            InputProps={{
                                startAdornment: <SecurityIcon color="action" sx={{ mr: 1 }} />,
                                sx: { borderRadius: 2 }
                            }}
                        />

                        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold">Restore Mode</Typography>
                            <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value)}>
                                <FormControlLabel value="merge" control={<Radio size="small" />} label={<Typography variant="body2">Merge (Keep existing)</Typography>} />
                                <FormControlLabel value="overwrite" control={<Radio size="small" />} label={<Typography variant="body2">Overwrite (Delete existing)</Typography>} />
                            </RadioGroup>
                        </Box>

                        <Button 
                            type="submit"
                            variant="contained" 
                            color="secondary" 
                            size="large"
                            startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <CloudUploadIcon />}
                            disabled={loading}
                            fullWidth
                            sx={{ 
                                py: 1.5, 
                                borderRadius: 3,
                                fontWeight: 600,
                                textTransform: 'none',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                            }}
                        >
                            {loading ? 'Restoring...' : 'Restore Data'}
                        </Button>
                    </Stack>
                </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Box mt={4}>
        <Typography variant="h6" fontWeight={700} gutterBottom>Backup History</Typography>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          {history.length === 0 ? (
            <Typography color="text.secondary">No backups found.</Typography>
          ) : (
            <Stack spacing={1}>
              {history.map((h, idx) => (
                <Box key={idx} display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">{h.file} — {new Date(h.createdAt).toLocaleString()}</Typography>
                  <Typography variant="caption" color="text.secondary">{h.size} bytes</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default Backup;
