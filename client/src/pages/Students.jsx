import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  getStudents, 
  createStudent, 
  updateStudent, 
  deleteStudent 
} from '../redux/studentSlice';
import {
  Box,
  Button,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Avatar,
  Tooltip,
  Card,
  CardContent,
  Chip,
  useTheme,
  alpha,
  CircularProgress,
  Stack,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationOnIcon,
  Business as BusinessIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import moment from 'moment';

const Students = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { companyId } = useParams();
  
  const { selectedCompany } = useSelector((state) => state.companies);
  const { students, loading } = useSelector((state) => state.students);
  
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage] = useState(0);
  const [rowsPerPage] = useState(10);
  
  const [currentStudent, setCurrentStudent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    studentId: '',
    email: '',
    contact: '',
    dateOfBirth: '',
    gender: 'Male',
    address: '',
    fatherName: '',
    motherName: '',
    guardianInfo: '',
    emergencyContact: '',
    status: 'Active',
    openingBalance: ''
  });

  useEffect(() => {
    const id = companyId || selectedCompany?._id;
    if (id) {
      dispatch(getStudents({
          companyId: id,
          page: currentPage + 1,
          limit: rowsPerPage,
          search: searchTerm
      }));
    }
  }, [dispatch, selectedCompany, companyId, currentPage, rowsPerPage, searchTerm]);

  const handleOpen = (student = null) => {
    if (student) {
      setCurrentStudent(student);
      setFormData({
        name: student.name,
        studentId: student.studentId || '',
        email: student.email || '',
        contact: student.contact || '',
        dateOfBirth: student.dateOfBirth ? moment(student.dateOfBirth).format('YYYY-MM-DD') : '',
        gender: student.gender || 'Male',
        address: student.address || '',
        fatherName: student.fatherName || '',
        motherName: student.motherName || '',
        guardianInfo: student.guardianInfo || '',
        emergencyContact: student.emergencyContact || '',
        status: student.status || 'Active',
        openingBalance: '' 
      });
    } else {
      setCurrentStudent(null);
      setFormData({
        name: '',
        studentId: '',
        email: '',
        contact: '',
        dateOfBirth: '',
        gender: 'Male',
        address: '',
        fatherName: '',
        motherName: '',
        guardianInfo: '',
        emergencyContact: '',
        status: 'Active',
        openingBalance: ''
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentStudent(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = companyId || selectedCompany?._id;
    if (!id) {
        toast.error('Institute ID missing. Please refresh the page.');
        return;
    }

    try {
      if (currentStudent) {
        await dispatch(updateStudent({ 
          id: currentStudent._id, 
          student: formData 
        })).unwrap();
        toast.success('Student updated successfully');
      } else {
        await dispatch(createStudent({ 
          ...formData, 
          companyId: id 
        })).unwrap();
        toast.success('Student created successfully');
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save student:', err);
      toast.error(err.message || 'Failed to save student');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await dispatch(deleteStudent(id)).unwrap();
        toast.success('Student deleted successfully');
      } catch (err) {
        console.error('Failed to delete student:', err);
        toast.error(err.message || 'Failed to delete student');
      }
    }
  };

  const filteredStudents = (students || []).filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExport = (type) => {
      const data = filteredStudents.map(c => ({
          name: c.name,
          email: c.email || '-',
          contact: c.contact || '-',
          address: c.address || '-',
          guardianInfo: c.guardianInfo || '-'
      }));

      const columns = [
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Contact', key: 'contact', width: 20 },
          { header: 'Address', key: 'address', width: 40 },
          { header: 'Guardian Info', key: 'guardianInfo', width: 20 }
      ];

      const title = 'Student List';
      const dateRange = moment().format('DD MMM YYYY');
      const themeColor = theme.palette.primary.main;

      if (type === 'excel') {
          exportToExcel(data, columns, title, dateRange, selectedCompany?.name, themeColor);
      } else {
          exportToPDF(data, columns, title, dateRange, selectedCompany?.name, themeColor);
      }
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* Header Section */}
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={2} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5 }}>
            Student Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage student enrollments, contact details, and academic history.
          </Typography>
        </Box>
        <Box display="flex" gap={2} width={{ xs: '100%', md: 'auto' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width="100%">
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('excel')}
                  sx={{ borderRadius: 2, whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 600, color: '#1D6F42', borderColor: '#1D6F42', flex: { xs: 1, sm: 'none' } }}
                >
                  Excel
                </Button>
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('pdf')}
                  sx={{ borderRadius: 2, whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 600, color: '#D32F2F', borderColor: '#D32F2F', flex: { xs: 1, sm: 'none' } }}
                >
                  PDF
                </Button>
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpen()}
                  sx={{
                    px: 3,
                    py: 1,
                    borderRadius: 2,
                    boxShadow: 'none',
                    bgcolor: 'primary.main',
                    flex: { xs: 1, sm: 'none' },
                    '&:hover': {
                        bgcolor: 'primary.dark',
                        boxShadow: 'none'
                    }
                  }}
                >
                  Add Student
                </Button>
            </Stack>
        </Box>
      </Box>

      {/* Search and Filter Section */}
      <Card sx={{ mb: 2, borderRadius: 3, overflow: 'visible', border: 'none', boxShadow: theme.shadows[1] }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box display="flex" alignItems="center" gap={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search students by name, email, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2, bgcolor: 'background.default' }
              }}
              variant="outlined"
            />
            <Tooltip title="Filter options">
              <IconButton size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', p: 1, borderRadius: 2, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } }}>
                <FilterListIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Students Table */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, boxShadow: theme.shadows[2], overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <TableRow>
              <TableCell sx={{ py: 1, fontWeight: 700, color: 'text.secondary', borderBottom: 'none' }}>Student Details</TableCell>
              <TableCell sx={{ py: 1, fontWeight: 700, color: 'text.secondary', borderBottom: 'none' }}>Contact Info</TableCell>
              <TableCell sx={{ py: 1, fontWeight: 700, color: 'text.secondary', borderBottom: 'none', display: { xs: 'none', md: 'table-cell' } }}>Location</TableCell>
              <TableCell sx={{ py: 1, fontWeight: 700, color: 'text.secondary', borderBottom: 'none' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={30} />
                  </TableCell>
                </TableRow>
            ) : students && students.length > 0 ? (
              students.map((student) => (
                <TableRow key={student._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 }, transition: 'background-color 0.2s' }}>
                  <TableCell sx={{ py: 0.5 }}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
                          fontWeight: 700,
                          borderRadius: 2,
                          fontSize: '0.875rem'
                        }}
                      >
                        {student.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} color="text.primary" fontSize="0.875rem">
                          {student.name}
                        </Typography>
                        {student.guardianInfo && (
                          <Chip
                            label={`Guardian: ${student.guardianInfo}`}
                            size="small"
                            sx={{ mt: 0, borderRadius: 1, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.dark', fontSize: '0.65rem', height: 16 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Box display="flex" flexDirection="column" gap={0}>
                      {student.email && (
                        <Box display="flex" alignItems="center" gap={1}>
                          <EmailIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 14 }} />
                          <Typography variant="caption" color="text.primary">{student.email}</Typography>
                        </Box>
                      )}
                      {student.contact && (
                        <Box display="flex" alignItems="center" gap={1}>
                          <PhoneIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 14 }} />
                          <Typography variant="caption" color="text.primary">{student.contact}</Typography>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.5, display: { xs: 'none', md: 'table-cell' } }}>
                    <Box display="flex" alignItems="flex-start" gap={1}>
                      <LocationOnIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 14, mt: 0.2 }} />
                      <Typography variant="caption" color="text.primary" sx={{ maxWidth: 200, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {student.address || <span style={{ color: theme.palette.text.disabled }}>No address</span>}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    <Box display="flex" justifyContent="flex-end" gap={0.5}>
                      <Tooltip title="Edit">
                        <IconButton
                          onClick={() => handleOpen(student)}
                          size="small"
                          sx={{
                            color: theme.palette.info.main,
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            borderRadius: 1.5,
                            padding: 0.5,
                            '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.2) }
                          }}
                        >
                          <EditIcon fontSize="small" sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => handleDelete(student._id)}
                          size="small"
                          sx={{
                            color: theme.palette.error.main,
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            borderRadius: 1.5,
                            padding: 0.5,
                            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) }
                          }}
                        >
                          <DeleteIcon fontSize="small" sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                    <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
                    <Typography variant="subtitle1" color="text.secondary">No students found</Typography>
                    <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mt: 1, borderRadius: 2 }}>
                      Add Student
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: { borderRadius: 3, boxShadow: theme.shadows[5] }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 3, py: 2 }}>
          <Typography variant="h6" fontWeight={700}>
            {currentStudent ? 'Edit Student' : 'Add New Student'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Student ID / Roll No"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                placeholder="e.g. CI-2024-001"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contact Number"
                name="contact"
                value={formData.contact}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  name="gender"
                  value={formData.gender}
                  label="Gender"
                  onChange={handleChange}
                >
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Father's Name"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Mother's Name"
                name="motherName"
                value={formData.motherName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                multiline
                rows={2}
                value={formData.address}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Emergency Contact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  label="Status"
                  onChange={handleChange}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                  <MenuItem value="Dropped">Dropped</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {!currentStudent && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Opening Balance (if any)"
                  name="openingBalance"
                  type="number"
                  value={formData.openingBalance}
                  onChange={handleChange}
                  helperText="Initial balance for the student's ledger"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
          <Button onClick={handleClose} size="medium" sx={{ borderRadius: 2, px: 3, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            size="medium"
            disabled={!formData.name}
            sx={{
              borderRadius: 2,
              px: 4,
              boxShadow: 'none',
              bgcolor: 'primary.main',
              '&:hover': {
                  bgcolor: 'primary.dark',
                  boxShadow: 'none'
              }
            }}
          >
            {currentStudent ? 'Update Student' : 'Save Student'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Students;
