import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { getBatches, createBatch, updateBatch, deleteBatch } from '../redux/batchSlice';
import { getCourses } from '../redux/courseSlice';
import { getTeachers } from '../redux/teacherSlice';
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
  Stack,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  OutlinedInput
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import GroupsIcon from '@mui/icons-material/Groups';
import moment from 'moment';

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const Batches = () => {
  const [formData, setFormData] = useState({ 
    name: '', 
    course: '', 
    startTime: '', 
    endTime: '', 
    days: [], 
    teacher: '',
    status: 'Upcoming'
  });
  const [currentId, setCurrentId] = useState(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const dispatch = useDispatch();
  const theme = useTheme();
  const { batches, loading } = useSelector((state) => state.batches);
  const { courses } = useSelector((state) => state.courses);
  const { teachers } = useSelector((state) => state.teachers);
  const { companyId } = useParams();

  useEffect(() => {
    if (companyId) {
      dispatch(getBatches(companyId));
      dispatch(getCourses(companyId));
      dispatch(getTeachers(companyId));
    }
  }, [dispatch, companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentId) {
        await dispatch(updateBatch({ id: currentId, batch: formData })).unwrap();
      } else {
        await dispatch(createBatch(formData)).unwrap();
      }
      handleClose();
    } catch (error) {
      alert(error.message || 'Failed to save batch');
    }
  };

  const handleEdit = (batch) => {
    setCurrentId(batch._id);
    setFormData({
      name: batch.name,
      course: batch.course?._id || batch.course || '',
      startTime: batch.startTime || '',
      endTime: batch.endTime || '',
      days: batch.days || [],
      teacher: batch.teacher?._id || batch.teacher || '',
      status: batch.status || 'Upcoming'
    });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this batch?')) {
      dispatch(deleteBatch(id));
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentId(null);
    setFormData({ 
      name: '', 
      course: '', 
      startTime: '', 
      endTime: '', 
      days: [], 
      teacher: '',
      status: 'Upcoming'
    });
  };

  const filteredBatches = useMemo(() => {
    return batches.filter(batch => 
      batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (batch.course?.name && batch.course.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [batches, searchTerm]);

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="text.primary">
            Batch Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage student batches, schedules, and assigned teachers.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Create Batch
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by batch name or course..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700 }}>Batch Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Schedule</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Teacher</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Students</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBatches.map((batch) => (
                <TableRow key={batch._id} hover>
                  <TableCell fontWeight={600}>{batch.name}</TableCell>
                  <TableCell>{batch.course?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {batch.startTime} - {batch.endTime}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {batch.days?.join(', ')}
                    </Typography>
                  </TableCell>
                  <TableCell>{batch.teacher?.name || 'Unassigned'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={`${batch.students?.length || 0} Students`} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={batch.status} 
                      size="small"
                      color={batch.status === 'Ongoing' ? 'success' : batch.status === 'Upcoming' ? 'info' : 'default'}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton onClick={() => handleEdit(batch)} color="primary" size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton onClick={() => handleDelete(batch._id)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filteredBatches.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    No batches found.
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
            {currentId ? 'Edit Batch' : 'Create New Batch'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Batch Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Course</InputLabel>
                  <Select
                    value={formData.course}
                    label="Course"
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  >
                    {courses.map(course => (
                      <MenuItem key={course._id} value={course._id}>{course.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Start Time"
                  placeholder="e.g. 10:00 AM"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="End Time"
                  placeholder="e.g. 12:00 PM"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Days</InputLabel>
                  <Select
                    multiple
                    value={formData.days}
                    onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                    input={<OutlinedInput label="Days" />}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <MenuItem key={day} value={day}>
                        <Checkbox checked={formData.days.indexOf(day) > -1} />
                        <ListItemText primary={day} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Teacher</InputLabel>
                  <Select
                    value={formData.teacher}
                    label="Teacher"
                    onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {teachers.map(teacher => (
                      <MenuItem key={teacher._id} value={teacher._id}>{teacher.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <MenuItem value="Upcoming">Upcoming</MenuItem>
                    <MenuItem value="Ongoing">Ongoing</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleClose} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={loading}>
              {currentId ? 'Update Batch' : 'Create Batch'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default Batches;
