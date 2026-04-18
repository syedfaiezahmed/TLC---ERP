import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { getCourses, createCourse, updateCourse, deleteCourse } from '../redux/courseSlice';
import { getGroups } from '../redux/groupSlice';
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
  InputAdornment,
  Tooltip,
  Chip,
  useTheme,
  alpha,
  MenuItem,
  Stack,
  CircularProgress
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import BookIcon from '@mui/icons-material/Book';
import SchoolIcon from '@mui/icons-material/School';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CategoryIcon from '@mui/icons-material/Category';
import DownloadIcon from '@mui/icons-material/Download';
import TimerIcon from '@mui/icons-material/Timer';
import StatCard from '../components/StatCard';
import { StatCardGridSkeleton, TableRowSkeleton } from '../components/SkeletonLoaders';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import moment from 'moment';

const StatusChip = ({ type }) => {
    const theme = useTheme();
    let label = type ? type.toUpperCase() : 'COURSE';
    let bgcolor = alpha(theme.palette.primary.main, 0.1);
    let textColor = theme.palette.primary.dark;

    if (type === 'workshop') {
        bgcolor = alpha(theme.palette.secondary.main, 0.1);
        textColor = theme.palette.secondary.dark;
    } else if (type === 'session') {
        bgcolor = alpha(theme.palette.info.main, 0.1);
        textColor = theme.palette.info.dark;
    }

    return (
        <Chip 
            label={label} 
            size="small" 
            sx={{ 
                bgcolor: bgcolor, 
                color: textColor,
                fontWeight: 600,
                borderRadius: 1,
                border: 'none'
            }} 
        />
    );
};

const Courses = () => {
  const [formData, setFormData] = useState({ name: '', description: '', fee: '', code: '', duration: '', type: 'course', teacherId: '', groupId: '' });
  const [currentId, setCurrentId] = useState(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  
  const dispatch = useDispatch();
  const theme = useTheme();
  const { courses, loading } = useSelector((state) => state.courses);
  const { selectedCompany } = useSelector((state) => state.companies);
  const { teachers } = useSelector((state) => state.teachers);
  const { groups } = useSelector((state) => state.groups);
  const { companyId } = useParams(); 
  const currentCompanyId = companyId || selectedCompany?._id;

  useEffect(() => {
    if (currentCompanyId) {
      dispatch(getCourses(currentCompanyId));
      dispatch(getGroups(currentCompanyId));
    }
  }, [dispatch, currentCompanyId]); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
        if (currentId) {
            await dispatch(updateCourse({ id: currentId, course: formData })).unwrap();
            alert("Course updated successfully!");
        } else {
            await dispatch(createCourse({ ...formData, companyId: currentCompanyId })).unwrap();
            alert("Course created successfully!");
        }
        clear();
        setOpen(false);
    } catch (error) {
        console.error('Failed to save course:', error);
        alert(`Failed to save course: ${error?.message || 'Unknown error'}`);
    } finally {
        setActionLoading(false);
    }
  };

  const clear = () => {
    setCurrentId(null);
    setFormData({ name: '', description: '', fee: '', code: '', duration: '', type: 'course', teacherId: '', groupId: '' });
  };

  const handleEdit = (course) => {
    setCurrentId(course._id);
    setFormData({
      name: course.name,
      description: course.description,
      fee: course.fee,
      code: course.code,
      duration: course.duration,
      type: course.type || 'course',
      teacherId: course.teacher?._id || course.teacher || '',
      groupId: course.group?._id || course.group || ''
    });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      dispatch(deleteCourse(id));
    }
  };

  const filteredCourses = useMemo(() => {
      return (courses || []).filter(course => {
          const matchesSearch = 
              course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (course.code && course.code.toLowerCase().includes(searchTerm.toLowerCase()));
          const matchesType = filterType === 'all' || course.type === filterType;
          const matchesGroup = filterGroup === 'all' ||
              (course.group?._id || course.group) === filterGroup;
          return matchesSearch && matchesType && matchesGroup;
      });
  }, [courses, searchTerm, filterType, filterGroup]);

  const stats = useMemo(() => {
      const totalCourses = (courses || []).length;
      const workshops = (courses || []).filter(c => c.type === 'workshop').length;
      const sessions = (courses || []).filter(c => c.type === 'session').length;
      const avgFee = totalCourses > 0 ? (courses || []).reduce((sum, c) => sum + (c.fee || 0), 0) / totalCourses : 0;
      return { totalCourses, workshops, sessions, avgFee };
  }, [courses]);

  const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 0
      }).format(amount || 0);
  };

  const handleExport = (type) => {
      const columns = [
          { header: 'Type', key: 'type', width: 15 },
          { header: 'Course Name', key: 'name', width: 30 },
          { header: 'Code', key: 'code', width: 15 },
          { header: 'Duration', key: 'duration', width: 20 },
          { header: 'Fee', key: 'fee', width: 15, format: 'currency', align: 'right' },
          { header: 'Teacher', key: 'teacher', width: 25 }
      ];
      const title = 'Course Catalog';
      const dateRange = `As of ${moment().format('DD MMM YYYY')}`;
      
      const data = filteredCourses.map(c => ({
          type: c.type ? c.type.toUpperCase() : 'COURSE',
          name: c.name,
          code: c.code || '-',
          duration: c.duration || '-',
          fee: c.fee || 0,
          teacher: c.teacher?.name || '-'
      }));

      if (type === 'excel') {
          exportToExcel(data, columns, title, dateRange, selectedCompany?.name, theme.palette.primary.main);
      } else {
          exportToPDF(data, columns, title, dateRange, selectedCompany?.name, theme.palette.primary.main);
      }
  };

  if (!currentCompanyId) {
      return (
        <Box p={3}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>Please select an institute from the Dashboard first.</Alert>
        </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
            <Grid item xs={12} md={6}>
                <Typography variant="h5" fontWeight={800} sx={{ 
                    color: 'text.primary',
                    mb: 0.5,
                    letterSpacing: -0.5
                }}>
                    Course Catalog
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Manage your courses, workshops, and individual learning sessions.
                </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button 
                        variant="outlined" 
                        startIcon={<DownloadIcon />} 
                        onClick={() => handleExport('excel')}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#1D6F42', borderColor: '#1D6F42' }}
                    >
                        Excel
                    </Button>
                    <Button 
                        variant="outlined" 
                        startIcon={<DownloadIcon />} 
                        onClick={() => handleExport('pdf')}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#D32F2F', borderColor: '#D32F2F' }}
                    >
                        PDF
                    </Button>
                    <Button 
                        variant="contained" 
                        size="medium"
                        startIcon={<AddIcon />} 
                        onClick={() => { clear(); setOpen(true); }}
                        sx={{ 
                            borderRadius: 2, 
                            textTransform: 'none', 
                            px: 3, 
                            py: 1,
                            boxShadow: 'none',
                            bgcolor: 'primary.main',
                            '&:hover': {
                                bgcolor: 'primary.dark',
                                boxShadow: 'none'
                            }
                        }}
                    >
                        Add Course
                    </Button>
                </Stack>
            </Grid>
        </Grid>
      </Box>

    {loading && courses.length === 0 ? (
        <StatCardGridSkeleton count={4} />
    ) : (
        <>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard 
                        title="Total Courses" 
                        value={stats.totalCourses} 
                        icon={<BookIcon />}
                        color={theme.palette.primary.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard 
                        title="Workshops" 
                        value={stats.workshops} 
                        icon={<SchoolIcon />}
                        color={theme.palette.secondary.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard 
                        title="Sessions" 
                        value={stats.sessions} 
                        icon={<TimerIcon />}
                        color={theme.palette.info.main}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard 
                        title="Avg. Fee" 
                        value={formatCurrency(stats.avgFee)} 
                        icon={<MonetizationOnIcon />}
                        color={theme.palette.success.main}
                    />
                </Grid>
            </Grid>
        </>
    )}

    {courses.length > 0 && (
      <Paper sx={{ 
          p: 0, 
          borderRadius: 4, 
          boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)', 
          overflow: 'hidden',
          mt: 2
      }}>
        {/* Filters */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
            <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        placeholder="Search courses by name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" fontSize="small" />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 2, bgcolor: 'white' }
                        }}
                        size="small"
                    />
                </Grid>
                <Grid item xs={6} md={2}>
                    <TextField
                        select fullWidth value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        size="small"
                        InputProps={{ startAdornment: (<InputAdornment position="start"><FilterListIcon color="action" fontSize="small" /></InputAdornment>), sx: { borderRadius: 2, bgcolor: 'white' } }}
                    >
                        <MenuItem value="all">All Types</MenuItem>
                        <MenuItem value="course">Course</MenuItem>
                        <MenuItem value="workshop">Workshop</MenuItem>
                        <MenuItem value="session">Session</MenuItem>
                    </TextField>
                </Grid>
                <Grid item xs={6} md={3}>
                    <TextField
                        select fullWidth value={filterGroup}
                        onChange={(e) => setFilterGroup(e.target.value)}
                        size="small"
                        InputProps={{ sx: { borderRadius: 2, bgcolor: 'white' } }}
                    >
                        <MenuItem value="all">All Groups</MenuItem>
                        {(groups || []).map((g) => (
                            <MenuItem key={g._id} value={g._id}>
                                <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: g.color || 'primary.main', mr: 1 }} />
                                {g.name}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
            </Grid>
        </Box>

        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Course Details</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Group</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Teacher</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Fee (PKR)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && filteredCourses.length === 0 ? (
                <TableRowSkeleton rows={6} cols={7} />
              ) : filteredCourses.map((course) => (
                <TableRow key={course._id} hover>
                  <TableCell sx={{ py: 0.5 }}>
                      <StatusChip type={course.type} />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                      <Box>
                          <Typography variant="subtitle2" fontWeight={600} fontSize="0.875rem">
                              {course.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                              Code: {course.code || '-'}
                          </Typography>
                      </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                      {course.group ? (
                          <Chip
                              label={course.group.name || course.group.code}
                              size="small"
                              sx={{ fontWeight: 600, borderRadius: 1, bgcolor: `${course.group.color || '#1976d2'}22`, color: course.group.color || 'primary.main' }}
                          />
                      ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                      <Typography variant="body2" fontSize="0.875rem">
                          {course.duration || '-'}
                      </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                      <Typography variant="body2" fontSize="0.875rem">
                          {course.teacher?.name || '-'}
                      </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="primary.main" fontSize="0.875rem">
                          {formatCurrency(course.fee)}
                      </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Edit Course">
                            <IconButton 
                                onClick={() => handleEdit(course)} 
                                size="small"
                                sx={{ 
                                    bgcolor: alpha(theme.palette.primary.main, 0.1), 
                                    color: 'primary.main', 
                                    padding: 0.5,
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } 
                                }}
                            >
                              <EditIcon fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Course">
                            <IconButton 
                                onClick={() => handleDelete(course._id)} 
                                size="small"
                                sx={{ 
                                    bgcolor: alpha(theme.palette.error.main, 0.1), 
                                    color: 'error.main', 
                                    padding: 0.5,
                                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } 
                                }}
                            >
                              <DeleteIcon fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCourses.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                              <BookIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                              <Typography variant="subtitle1" color="text.secondary">
                                  No courses found
                              </Typography>
                          </Box>
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{currentId ? 'Edit Course' : 'Add New Course'}</DialogTitle>
        <DialogContent dividers>
          <Box component="form" noValidate sx={{ mt: 1 }}>
            <Grid container spacing={2}>
                <Grid item xs={12}>
                    <TextField
                        name="name"
                        label="Course Name"
                        fullWidth
                        size="small"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        variant="outlined"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        select
                        name="type"
                        label="Type"
                        fullWidth
                        size="small"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        variant="outlined"
                    >
                        <MenuItem value="course">Course</MenuItem>
                        <MenuItem value="workshop">Workshop</MenuItem>
                        <MenuItem value="session">Session</MenuItem>
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        name="code"
                        label="Course Code"
                        fullWidth
                        size="small"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        variant="outlined"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        name="duration"
                        label="Duration (e.g. 3 Months)"
                        fullWidth
                        size="small"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        variant="outlined"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        name="fee"
                        label="Course Fee (PKR)"
                        type="number"
                        fullWidth
                        size="small"
                        value={formData.fee}
                        onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                        required
                        variant="outlined"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">Rs</Typography>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        select name="teacherId" label="Assigned Teacher"
                        fullWidth size="small"
                        value={formData.teacherId}
                        onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                        variant="outlined"
                    >
                        <MenuItem value="">Unassigned</MenuItem>
                        {teachers.map((t) => (
                            <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>
                        ))}
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        select name="groupId" label="Academic Group"
                        fullWidth size="small"
                        value={formData.groupId}
                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                        variant="outlined"
                    >
                        <MenuItem value="">— No Group —</MenuItem>
                        {(groups || []).map((g) => (
                            <MenuItem key={g._id} value={g._id}>
                                <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: g.color || 'primary.main', mr: 1, verticalAlign: 'middle' }} />
                                {g.name}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        name="description"
                        label="Description"
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        variant="outlined"
                    />
                </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} color="inherit" disabled={actionLoading}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            sx={{ px: 3 }}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {actionLoading ? 'Saving...' : (currentId ? 'Save Changes' : 'Create Course')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Courses;
