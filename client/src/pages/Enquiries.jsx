import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { getEnquiries, createEnquiry, updateEnquiry, deleteEnquiry } from '../redux/enquirySlice';
import { getCourses } from '../redux/courseSlice';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  Box,
  Tooltip,
  Chip,
  useTheme,
  alpha,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import moment from 'moment';
import WhatsAppContact from '../components/WhatsAppContact';

const Enquiries = () => {
  const [formData, setFormData] = useState({ 
    name: '', 
    contact: '', 
    email: '', 
    courseOfInterest: '', 
    source: 'Walk-in', 
    remarks: '', 
    followUpDate: moment().add(1, 'days').format('YYYY-MM-DD')
  });
  const [currentId, setCurrentId] = useState(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const dispatch = useDispatch();
  const theme = useTheme();
  const { companyId } = useParams();
  
  const { enquiries, loading } = useSelector((state) => state.enquiries);
  const { courses } = useSelector((state) => state.courses);

  useEffect(() => {
    if (companyId) {
      dispatch(getEnquiries(companyId));
      dispatch(getCourses(companyId));
    }
  }, [dispatch, companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentId) {
        await dispatch(updateEnquiry({ id: currentId, enquiry: formData })).unwrap();
      } else {
        await dispatch(createEnquiry(formData)).unwrap();
      }
      handleClose();
    } catch (error) {
      alert(error.message || 'Failed to save enquiry');
    }
  };

  const handleEdit = (enquiry) => {
    setCurrentId(enquiry._id);
    setFormData({
      name: enquiry.name,
      contact: enquiry.contact,
      email: enquiry.email || '',
      courseOfInterest: enquiry.courseOfInterest?._id || enquiry.courseOfInterest || '',
      source: enquiry.source || 'Walk-in',
      status: enquiry.status || 'Pending',
      remarks: enquiry.remarks || '',
      followUpDate: enquiry.followUpDate ? moment(enquiry.followUpDate).format('YYYY-MM-DD') : ''
    });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this enquiry?')) {
      dispatch(deleteEnquiry(id));
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentId(null);
    setFormData({ 
      name: '', 
      contact: '', 
      email: '', 
      courseOfInterest: '', 
      source: 'Walk-in', 
      remarks: '', 
      followUpDate: moment().add(1, 'days').format('YYYY-MM-DD')
    });
  };

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.contact.includes(searchTerm)
    );
  }, [enquiries, searchTerm]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Enrolled': return 'success';
      case 'Followed Up': return 'info';
      case 'Closed': return 'error';
      default: return 'warning';
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="text.primary">
            Enquiry Management (CRM)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track leads, follow-ups, and convert enquiries into enrollments.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Add Enquiry
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by name or contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Follow-up</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEnquiries.map((enquiry) => (
                <TableRow key={enquiry._id} hover>
                  <TableCell fontWeight={600}>{enquiry.name}</TableCell>
                  <TableCell><WhatsAppContact value={enquiry.contact} /></TableCell>
                  <TableCell>{enquiry.courseOfInterest?.name || 'N/A'}</TableCell>
                  <TableCell>{enquiry.source}</TableCell>
                  <TableCell>
                    {enquiry.followUpDate ? moment(enquiry.followUpDate).format('DD MMM YYYY') : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={enquiry.status} 
                      size="small"
                      color={getStatusColor(enquiry.status)}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton onClick={() => handleEdit(enquiry)} color="primary" size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton onClick={() => handleDelete(enquiry._id)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEnquiries.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    No enquiries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {currentId ? 'Edit Enquiry' : 'Add New Enquiry'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact"
                  required
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Course of Interest</InputLabel>
                  <Select
                    value={formData.courseOfInterest}
                    label="Course of Interest"
                    onChange={(e) => setFormData({ ...formData, courseOfInterest: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {courses.map(course => (
                      <MenuItem key={course._id} value={course._id}>{course.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Source</InputLabel>
                  <Select
                    value={formData.source}
                    label="Source"
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <MenuItem value="Walk-in">Walk-in</MenuItem>
                    <MenuItem value="Social Media">Social Media</MenuItem>
                    <MenuItem value="Referral">Referral</MenuItem>
                    <MenuItem value="Website">Website</MenuItem>
                    <MenuItem value="Advertisement">Advertisement</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Next Follow-up Date"
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              {currentId && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      label="Status"
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <MenuItem value="Pending">Pending</MenuItem>
                      <MenuItem value="Followed Up">Followed Up</MenuItem>
                      <MenuItem value="Enrolled">Enrolled</MenuItem>
                      <MenuItem value="Closed">Closed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Remarks"
                  multiline
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleClose} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {currentId ? 'Update Enquiry' : 'Add Enquiry'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default Enquiries;
