import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { getExams, createExam, updateExam, deleteExam, saveExamResults, getExamById } from '../redux/examSlice';
import { getBatches } from '../redux/batchSlice';
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
  Stack,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Avatar,
  Tab,
  Tabs
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import AssignmentIcon from '@mui/icons-material/Assignment';
import moment from 'moment';

const Exams = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({ 
    title: '', 
    date: moment().format('YYYY-MM-DD'), 
    course: '', 
    batch: '', 
    totalMarks: 100, 
    passingMarks: 33, 
    remarks: '' 
  });
  const [currentId, setCurrentId] = useState(null);
  const [open, setOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [localResults, setLocalResults] = useState([]);
  
  const dispatch = useDispatch();
  const theme = useTheme();
  const { companyId } = useParams();
  
  const { exams, currentExam, currentResults, loading } = useSelector((state) => state.exams);
  const { batches } = useSelector((state) => state.batches);
  const { courses } = useSelector((state) => state.courses);

  useEffect(() => {
    if (companyId) {
      dispatch(getExams(companyId));
      dispatch(getBatches(companyId));
      dispatch(getCourses(companyId));
    }
  }, [dispatch, companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentId) {
        await dispatch(updateExam({ id: currentId, exam: formData })).unwrap();
      } else {
        await dispatch(createExam(formData)).unwrap();
      }
      handleClose();
    } catch (error) {
      alert(error.message || 'Failed to save exam');
    }
  };

  const handleEdit = (exam) => {
    setCurrentId(exam._id);
    setFormData({
      title: exam.title,
      date: moment(exam.date).format('YYYY-MM-DD'),
      course: exam.course?._id || exam.course || '',
      batch: exam.batch?._id || exam.batch || '',
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      remarks: exam.remarks || ''
    });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this exam and all its results?')) {
      dispatch(deleteExam(id));
    }
  };

  const handleOpenResults = async (exam) => {
    await dispatch(getExamById(exam._id)).unwrap();
    setResultOpen(true);
  };

  // Sync local results when currentResults changes
  useEffect(() => {
    if (currentResults && currentExam) {
      const batch = batches.find(b => b._id === currentExam.batch?._id || currentExam.batch);
      if (batch && batch.students) {
        const results = batch.students.map(student => {
          const existing = currentResults.find(r => r.student?._id === student._id);
          return {
            student: student._id,
            name: student.name,
            studentId: student.studentId,
            marksObtained: existing ? existing.marksObtained : 0,
            status: existing ? existing.status : 'Pass',
            remarks: existing ? existing.remarks : ''
          };
        });
        setLocalResults(results);
      }
    }
  }, [currentResults, currentExam, batches]);

  const handleLocalResultChange = (index, field, value) => {
    const newResults = [...localResults];
    newResults[index][field] = value;
    
    // Auto-calculate status if marks change
    if (field === 'marksObtained' && currentExam) {
      newResults[index].status = value >= currentExam.passingMarks ? 'Pass' : 'Fail';
    }
    
    setLocalResults(newResults);
  };

  const handleSaveResults = async () => {
    try {
      await dispatch(saveExamResults({ id: currentExam._id, results: localResults })).unwrap();
      alert('Results saved successfully!');
      setResultOpen(false);
    } catch (error) {
      alert(error.message || 'Failed to save results');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentId(null);
    setFormData({ 
      title: '', 
      date: moment().format('YYYY-MM-DD'), 
      course: '', 
      batch: '', 
      totalMarks: 100, 
      passingMarks: 33, 
      remarks: '' 
    });
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="text.primary">
            Exams & Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Schedule examinations and manage student performance results.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Schedule Exam
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700 }}>Exam Title</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Course / Batch</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Marks (Total/Pass)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam._id} hover>
                  <TableCell fontWeight={600}>{exam.title}</TableCell>
                  <TableCell>{moment(exam.date).format('DD MMM YYYY')}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{exam.course?.name || 'N/A'}</Typography>
                    <Typography variant="caption" color="text.secondary">{exam.batch?.name || 'N/A'}</Typography>
                  </TableCell>
                  <TableCell>{exam.totalMarks} / {exam.passingMarks}</TableCell>
                  <TableCell>
                    <Chip 
                      label={exam.status} 
                      size="small"
                      color={exam.status === 'Completed' ? 'success' : 'primary'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Enter Results">
                      <Button size="small" variant="outlined" onClick={() => handleOpenResults(exam)} sx={{ mr: 1 }}>
                        Results
                      </Button>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton onClick={() => handleEdit(exam)} color="primary" size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton onClick={() => handleDelete(exam._id)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {exams.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    No exams found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Schedule Exam Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {currentId ? 'Edit Exam' : 'Schedule New Exam'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Exam Title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
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
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Batch</InputLabel>
                  <Select
                    value={formData.batch}
                    label="Batch"
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  >
                    {batches.map(batch => (
                      <MenuItem key={batch._id} value={batch._id}>{batch.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Total Marks"
                  type="number"
                  required
                  value={formData.totalMarks}
                  onChange={(e) => setFormData({ ...formData, totalMarks: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Passing Marks"
                  type="number"
                  required
                  value={formData.passingMarks}
                  onChange={(e) => setFormData({ ...formData, passingMarks: e.target.value })}
                />
              </Grid>
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
              {currentId ? 'Update Exam' : 'Schedule Exam'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Enter Results Dialog */}
      <Dialog open={resultOpen} onClose={() => setResultOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Enter Results: {currentExam?.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              Total Marks: {currentExam?.totalMarks} | Passing Marks: {currentExam?.passingMarks}
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveResults}>
            Save Results
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {localResults.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Student Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Marks Obtained</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {localResults.map((result, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{result.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{result.studentId}</Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={result.marksObtained}
                          onChange={(e) => handleLocalResultChange(index, 'marksObtained', Number(e.target.value))}
                          inputProps={{ max: currentExam?.totalMarks, min: 0 }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={result.status} 
                          color={result.status === 'Pass' ? 'success' : result.status === 'Fail' ? 'error' : 'default'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={result.remarks}
                          onChange={(e) => handleLocalResultChange(index, 'remarks', e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No students found in the selected batch.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResultOpen(false)} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Exams;
