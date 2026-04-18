import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import moment from 'moment';
import {
  Box, Container, Paper, Typography, Tabs, Tab, Grid, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Switch, FormControlLabel,
  Alert, Snackbar, CircularProgress, LinearProgress, Divider, Stack, Card, CardContent,
  Tooltip, Badge, alpha, InputAdornment, Collapse, List, ListItem, ListItemText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SchoolIcon from '@mui/icons-material/School';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import ClassIcon from '@mui/icons-material/Class';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BlockIcon from '@mui/icons-material/Block';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getStudents } from '../redux/studentSlice';
import { getCourses } from '../redux/courseSlice';
import {
  fetchEnrollments, createEnrollment, updateEnrollment, deleteEnrollment,
  fetchEnrollmentStatistics, clearSuccess, clearError,
} from '../redux/enrollmentSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null || isNaN(n)) return 'PKR 0';
  return 'PKR ' + Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 });
};

const StatusChip = ({ status }) => {
  const map = {
    active:    { label: 'Active',    color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    completed: { label: 'Completed', color: 'info',    icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    dropped:   { label: 'Dropped',   color: 'error',   icon: <BlockIcon sx={{ fontSize: 14 }} /> },
    suspended: { label: 'Suspended', color: 'warning', icon: <AccessTimeIcon sx={{ fontSize: 14 }} /> },
    on_hold:   { label: 'On Hold',   color: 'default', icon: <AccessTimeIcon sx={{ fontSize: 14 }} /> },
  };
  const s = map[status] || map.active;
  return <Chip label={s.label} color={s.color} size="small" icon={s.icon} sx={{ fontWeight: 600 }} />;
};

const StatCard = ({ title, value, icon, color, subtitle }) => {
  const theme = useTheme();
  return (
    <Card elevation={0} sx={{ border: `1px solid ${alpha(color, 0.2)}`, borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color, mt: 0.5, lineHeight: 1.2 }}>
              {value}
            </Typography>
            {subtitle && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{subtitle}</Typography>}
          </Box>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(color, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── Fee Calculator Component ─────────────────────────────────────────────────
const FeeCalculator = ({ course, formData, setFormData }) => {
  const originalFee = formData.originalFee || course?.fee || 0;
  const finalFee = formData.finalFee || originalFee;
  const discountAmount = Math.max(0, originalFee - finalFee);
  const discountPercent = originalFee > 0 ? ((discountAmount / originalFee) * 100).toFixed(1) : 0;

  const handleOriginalChange = (val) => {
    const num = parseFloat(val) || 0;
    setFormData(d => ({ ...d, originalFee: num, finalFee: d.finalFee || num }));
  };

  const handleFinalChange = (val) => {
    const num = parseFloat(val) || 0;
    setFormData(d => ({ ...d, finalFee: Math.min(num, d.originalFee || num) }));
  };

  return (
    <Box sx={{ p: 2.5, bgcolor: alpha('#6366f1', 0.03), borderRadius: 2, border: '1px solid', borderColor: alpha('#6366f1', 0.15) }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AttachMoneyIcon fontSize="small" color="primary" />
        Fee Configuration
      </Typography>

      <Grid container spacing={2}>
        {/* Original Fee (Course Standard) */}
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Standard Course Fee"
            type="number"
            value={originalFee}
            onChange={e => handleOriginalChange(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
            }}
            helperText="Auto-fetched from course"
          />
        </Grid>

        {/* Final Fee (Editable) */}
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Final Fee (After Discount)"
            type="number"
            value={finalFee}
            onChange={e => handleFinalChange(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'white',
                fontWeight: 700,
              }
            }}
          />
        </Grid>

        {/* Discount Display */}
        <Grid item xs={12} sm={4}>
          <Box sx={{ p: 1.5, bgcolor: discountAmount > 0 ? alpha('#22c55e', 0.1) : 'grey.50', borderRadius: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary">Discount</Typography>
            <Typography variant="body1" fontWeight={700} color={discountAmount > 0 ? 'success.main' : 'text.secondary'}>
              {fmt(discountAmount)}
              {discountAmount > 0 && <span style={{ fontSize: '0.75rem', marginLeft: 8 }}>({discountPercent}%)</span>}
            </Typography>
          </Box>
        </Grid>

        {/* Visual Summary */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through', opacity: 0.7 }}>
              {fmt(originalFee)}
            </Typography>
            <Typography variant="h5" fontWeight={800} color="primary.main">
              {fmt(finalFee)}
            </Typography>
            {discountAmount > 0 && (
              <Chip
                label={`Save ${fmt(discountAmount)}`}
                color="success"
                size="small"
                sx={{ fontWeight: 700 }}
              />
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Discount Reason */}
      <TextField
        fullWidth
        size="small"
        label="Discount Reason (optional)"
        value={formData.discountReason || ''}
        onChange={e => setFormData(d => ({ ...d, discountReason: e.target.value }))}
        sx={{ mt: 2 }}
        placeholder="e.g., Early bird offer, sibling discount, etc."
      />
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const EnrollmentManagement = () => {
  const dispatch = useDispatch();
  const { companyId } = useParams();
  const theme = useTheme();

  const { selectedCompany } = useSelector(s => s.companies || {});
  const { students = [] } = useSelector(s => s.students || {});
  const { courses = [] } = useSelector(s => s.courses || {});
  const { enrollments, statistics, pagination, loading, errors, successMessage } = useSelector(s => s.enrollments || {});

  const cid = companyId || selectedCompany?._id;

  // ─── Tab state ─────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState(0);

  // ─── Filters ─────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    status: '',
    studentId: '',
    courseId: '',
    search: '',
  });

  // ─── Dialog state ────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // ─── Status Change Dialog ────────────────────────────────────────────────────
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusAction, setStatusAction] = useState(null); // 'drop', 'complete', 'suspend'
  const [statusForm, setStatusForm] = useState({
    status: '',
    dropDate: moment().format('YYYY-MM-DD'),
    dropReason: '',
    actualEndDate: moment().format('YYYY-MM-DD'),
    suspensionDate: moment().format('YYYY-MM-DD'),
    suspensionReason: '',
    notes: '',
  });

  // ─── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    studentId: null,
    courseId: null,
    batchId: '',
    enrollmentDate: moment().format('YYYY-MM-DD'),
    startDate: moment().format('YYYY-MM-DD'),
    originalFee: '',
    finalFee: '',
    discountReason: '',
    dueDay: 10,
    admissionFee: 1000,
    admissionFeeApplied: true,
    notes: '',
  });

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [expandedStats, setExpandedStats] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);

  // ─── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!cid) return;
    dispatch(getStudents({ companyId: cid, limit: 1000 }));
    dispatch(getCourses(cid));
    loadEnrollments();
  }, [cid, dispatch]);

  const loadEnrollments = useCallback(() => {
    if (!cid) return;
    dispatch(fetchEnrollments({
      companyId: cid,
      page: 1,
      limit: 50,
      status: filters.status || undefined,
      studentId: filters.studentId || undefined,
      courseId: filters.courseId || undefined,
    }));
  }, [cid, filters, dispatch]);

  // ─── Load statistics when tab changes ───────────────────────────────────────
  useEffect(() => {
    if (mainTab === 1 && cid) {
      dispatch(fetchEnrollmentStatistics({ companyId: cid }));
    }
  }, [mainTab, cid]);

  // ─── Form handlers ───────────────────────────────────────────────────────────
  const handleStudentChange = (_, student) => {
    setSelectedStudent(student);
    setFormData(d => ({ ...d, studentId: student?._id || null }));
  };

  const handleCourseChange = (_, course) => {
    setSelectedCourse(course);
    const fee = course?.fee || 0;
    setFormData(d => ({
      ...d,
      courseId: course?._id || null,
      originalFee: fee,
      finalFee: d.finalFee || fee,
    }));
  };

  const resetForm = () => {
    setFormData({
      studentId: null,
      courseId: null,
      batchId: '',
      enrollmentDate: moment().format('YYYY-MM-DD'),
      startDate: moment().format('YYYY-MM-DD'),
      originalFee: '',
      finalFee: '',
      discountReason: '',
      dueDay: 10,
      admissionFee: 1000,
      admissionFeeApplied: true,
      notes: '',
    });
    setSelectedStudent(null);
    setSelectedCourse(null);
    setEditingId(null);
  };

  const handleOpenDialog = (enrollment = null) => {
    if (enrollment) {
      setEditingId(enrollment._id);
      setSelectedStudent(enrollment.student);
      setSelectedCourse(enrollment.course);
      setFormData({
        studentId: enrollment.student?._id,
        courseId: enrollment.course?._id,
        batchId: enrollment.batch?._id || '',
        enrollmentDate: moment(enrollment.enrollmentDate).format('YYYY-MM-DD'),
        startDate: moment(enrollment.startDate).format('YYYY-MM-DD'),
        originalFee: enrollment.originalFee || enrollment.course?.fee || enrollment.monthlyFee || 0,
        finalFee: enrollment.finalFee || enrollment.netMonthlyFee || enrollment.monthlyFee || 0,
        discountReason: enrollment.discountReason || '',
        dueDay: enrollment.dueDay || 10,
        admissionFee: enrollment.admissionFee || 1000,
        admissionFeeApplied: enrollment.admissionFeeApplied !== false,
        notes: enrollment.notes || '',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
    // Clear any enrollment errors when closing dialog
    dispatch(clearError('createEnrollment'));
    dispatch(clearError('updateEnrollment'));
  };

  const handleSubmit = () => {
    if (!formData.studentId || !formData.courseId) return;

    const payload = {
      companyId: cid,
      studentId: formData.studentId,
      courseId: formData.courseId,
      batchId: formData.batchId || undefined,
      enrollmentDate: formData.enrollmentDate,
      startDate: formData.startDate,
      originalFee: parseFloat(formData.originalFee) || 0,
      finalFee: parseFloat(formData.finalFee) || 0,
      discountReason: formData.discountReason,
      dueDay: parseInt(formData.dueDay) || 10,
      admissionFee: parseFloat(formData.admissionFee) || 1000,
      admissionFeeApplied: formData.admissionFeeApplied,
      notes: formData.notes,
    };

    if (editingId) {
      dispatch(updateEnrollment({ id: editingId, data: payload })).then((res) => {
        if (!res.error) {
          handleCloseDialog();
          loadEnrollments();
        }
      });
    } else {
      dispatch(createEnrollment(payload)).then((res) => {
        if (!res.error) {
          handleCloseDialog();
          loadEnrollments();
        }
      });
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      dispatch(deleteEnrollment(deleteId)).then(() => {
        setDeleteConfirmOpen(false);
        setDeleteId(null);
      });
    }
  };

  // ─── Status Change Handlers ──────────────────────────────────────────────────
  const openStatusDialog = (enrollment, action) => {
    setSelectedEnrollment(enrollment);
    setStatusAction(action);
    const statusMap = {
      drop: 'dropped',
      complete: 'completed',
      suspend: 'suspended',
      reactivate: 'active',
    };
    setStatusForm({
      status: statusMap[action] || 'active',
      dropDate: moment().format('YYYY-MM-DD'),
      dropReason: '',
      actualEndDate: moment().format('YYYY-MM-DD'),
      suspensionDate: moment().format('YYYY-MM-DD'),
      suspensionReason: '',
      notes: enrollment.notes || '',
    });
    setStatusDialogOpen(true);
  };

  const closeStatusDialog = () => {
    setStatusDialogOpen(false);
    setSelectedEnrollment(null);
    setStatusAction(null);
    dispatch(clearError('updateEnrollment'));
  };

  const submitStatusChange = () => {
    if (!selectedEnrollment) return;

    const payload = {
      companyId: cid,
      status: statusForm.status,
    };

    if (statusForm.status === 'dropped') {
      payload.dropDate = statusForm.dropDate;
      payload.dropReason = statusForm.dropReason;
    } else if (statusForm.status === 'completed') {
      payload.actualEndDate = statusForm.actualEndDate;
    } else if (statusForm.status === 'suspended') {
      payload.suspensionDate = statusForm.suspensionDate;
      payload.suspensionReason = statusForm.suspensionReason;
    }

    dispatch(updateEnrollment({ id: selectedEnrollment._id, data: payload })).then((res) => {
      if (!res.error) {
        closeStatusDialog();
        loadEnrollments();
      }
    });
  };

  // ─── Derived data ──────────────────────────────────────────────────────────
  const filteredEnrollments = enrollments.filter(e => {
    const matchesSearch = !filters.search ||
      e.student?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      e.course?.name?.toLowerCase().includes(filters.search.toLowerCase());
    return matchesSearch;
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth={false} sx={{ mt: 3, mb: 4 }}>
      <Snackbar open={!!successMessage} autoHideDuration={4000} onClose={() => dispatch(clearSuccess())}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity="success" onClose={() => dispatch(clearSuccess())} sx={{ fontWeight: 600 }}>{successMessage}</Alert>
      </Snackbar>

      {/* Page Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Admission & Enrollment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage student enrollments · Configure fees & discounts · Track admission fees
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ fontWeight: 700, textTransform: 'none' }}
        >
          New Enrollment
        </Button>
      </Box>

      {/* Main Tabs */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}
          sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '0.95rem', minHeight: 56 } }}>
          <Tab icon={<SchoolIcon />} iconPosition="start" label="Enrollments" />
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Statistics & Reports" />
        </Tabs>

        {/* ══════════════════════ TAB 1: ENROLLMENTS ══════════════════════ */}
        {mainTab === 0 && (
          <Box sx={{ p: 3 }}>
            {/* Filters */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search student or course..."
                    value={filters.search}
                    onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      label="Status"
                      onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="dropped">Dropped</MenuItem>
                      <MenuItem value="suspended">Suspended</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Autocomplete
                    size="small"
                    options={courses}
                    getOptionLabel={o => o.name || ''}
                    value={courses.find(c => c._id === filters.courseId) || null}
                    onChange={(_, v) => setFilters(f => ({ ...f, courseId: v?._id || '' }))}
                    renderInput={p => <TextField {...p} label="Filter by Course" />}
                  />
                </Grid>
                <Grid item xs="auto" sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadEnrollments} disabled={loading.enrollments}>
                    Refresh
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {errors.enrollments && <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError('enrollments'))}>{errors.enrollments}</Alert>}

            {/* Enrollments Table */}
            {loading.enrollments ? <LinearProgress /> : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Group</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Batch</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Fee Structure</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Enrolled On</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEnrollments.length > 0 ? filteredEnrollments.map(e => {
                      const originalFee = e.originalFee || e.course?.fee || e.monthlyFee || 0;
                      const finalFee = e.finalFee || e.netMonthlyFee || e.monthlyFee || 0;
                      const discount = Math.max(0, originalFee - finalFee);
                      const hasAdmissionFee = e.admissionFeeApplied && !e.admissionFeeCharged;

                      return (
                        <TableRow key={e._id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                              <Box>
                                <Typography variant="body2" fontWeight={700}>{e.student?.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{e.student?.email}</Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <ClassIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                              <Typography variant="body2">{e.course?.name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {e.course?.group ? (
                              <Chip
                                label={e.course.group.name || e.course.group.code}
                                size="small"
                                sx={{ fontWeight: 600, borderRadius: 1, bgcolor: `${e.course.group.color || '#1976d2'}22`, color: e.course.group.color || 'primary.main' }}
                              />
                            ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                          </TableCell>
                          <TableCell>
                            {e.batch ? (
                              <Chip label={e.batch.name} size="small" sx={{ fontWeight: 600, borderRadius: 1, bgcolor: 'grey.100', color: 'text.primary' }} />
                            ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through', minWidth: 50 }}>
                                  {fmt(originalFee)}
                                </Typography>
                                <Typography variant="body2" fontWeight={700} color="primary.main">
                                  {fmt(finalFee)}
                                </Typography>
                                {discount > 0 && (
                                  <Chip label={`-${fmt(discount)}`} size="small" color="success" sx={{ fontSize: '0.65rem', height: 20 }} />
                                )}
                              </Box>
                              {hasAdmissionFee && (
                                <Typography variant="caption" color="info.main">
                                  + Admission fee {fmt(e.admissionFee || 1000)} (pending)
                                </Typography>
                              )}
                              {e.admissionFeeCharged && (
                                <Typography variant="caption" color="text.disabled">
                                  Admission fee charged
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center"><StatusChip status={e.status} /></TableCell>
                          <TableCell>{moment(e.enrollmentDate).format('DD MMM YYYY')}</TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              {e.status === 'active' && (
                                <>
                                  <Tooltip title="Drop Course">
                                    <IconButton size="small" color="error" onClick={() => openStatusDialog(e, 'drop')}>
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Complete Course">
                                    <IconButton size="small" color="success" onClick={() => openStatusDialog(e, 'complete')}>
                                      <CheckCircleOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Suspend">
                                    <IconButton size="small" color="warning" onClick={() => openStatusDialog(e, 'suspend')}>
                                      <PauseCircleIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                              {e.status === 'suspended' && (
                                <Tooltip title="Reactivate">
                                  <IconButton size="small" color="success" onClick={() => openStatusDialog(e, 'reactivate')}>
                                    <CheckCircleIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => handleOpenDialog(e)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeleteClick(e._id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                          <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                          <Typography color="text.secondary">
                            No enrollments found. Click "New Enrollment" to add students to courses.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Showing {(pagination.page - 1) * 50 + 1} - {Math.min(pagination.page * 50, pagination.total)} of {pagination.total} enrollments
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ══════════════════════ TAB 2: STATISTICS ══════════════════════ */}
        {mainTab === 1 && (
          <Box sx={{ p: 3 }}>
            {loading.statistics ? <LinearProgress /> : statistics ? (
              <>
                {/* Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Total Enrollments"
                      value={statistics.summary?.totalEnrollments || 0}
                      icon={<SchoolIcon />}
                      color={theme.palette.primary.main}
                      subtitle={`${statistics.summary?.activeEnrollments || 0} active`}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Original Fee Value"
                      value={fmt(statistics.summary?.totalOriginalFee)}
                      icon={<AttachMoneyIcon />}
                      color={theme.palette.info.main}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Final Fee Value"
                      value={fmt(statistics.summary?.totalFinalFee)}
                      icon={<TrendingDownIcon />}
                      color={theme.palette.success.main}
                      subtitle={`After discounts`}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      title="Total Discounts"
                      value={fmt(statistics.summary?.totalDiscount)}
                      icon={<ReceiptIcon />}
                      color={theme.palette.warning.main}
                      subtitle={`${statistics.byStudent?.length || 0} students with discount`}
                    />
                  </Grid>
                </Grid>

                {/* Course-wise Breakdown */}
                <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" fontWeight={700}>Course-wise Fee & Discount Breakdown</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Enrollments</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Original Total</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Final Total</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Discount Given</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Avg Discount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {statistics.byCourse?.map(c => (
                          <TableRow key={c._id} hover>
                            <TableCell fontWeight={600}>{c.courseName}</TableCell>
                            <TableCell align="right">{c.enrollments}</TableCell>
                            <TableCell align="right" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                              {fmt(c.totalOriginalFee)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                              {fmt(c.totalFinalFee)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>
                              {fmt(c.totalDiscount)}
                            </TableCell>
                            <TableCell align="right">{fmt(c.avgDiscount)}</TableCell>
                          </TableRow>
                        ))}
                        {!statistics.byCourse?.length && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                              <Typography color="text.secondary">No course data available</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                {/* Student-wise Discount (Top 10) */}
                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box
                    sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpandedStats(!expandedStats)}
                  >
                    <Typography variant="subtitle1" fontWeight={700}>Top Students by Discount Received</Typography>
                    <IconButton size="small">
                      {expandedStats ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={expandedStats}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Enrollments</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total Discount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {statistics.byStudent?.map(s => (
                            <TableRow key={s._id} hover>
                              <TableCell fontWeight={600}>{s.studentName}</TableCell>
                              <TableCell align="right">{s.totalEnrollments}</TableCell>
                              <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>
                                {fmt(s.totalDiscount)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {!statistics.byStudent?.length && (
                            <TableRow>
                              <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                                <Typography color="text.secondary">No discount data available</Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Paper>
              </>
            ) : (
              <Box p={5} textAlign="center">
                <AssessmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">Statistics not available</Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* ══════════════════════ ENROLLMENT DIALOG ══════════════════════ */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          {editingId ? 'Edit Enrollment' : 'Create New Enrollment'}
        </DialogTitle>
        <DialogContent dividers>
          {/* Show create/update errors in dialog */}
          {(errors.createEnrollment || errors.updateEnrollment) && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError(editingId ? 'updateEnrollment' : 'createEnrollment'))}>
              {errors.createEnrollment || errors.updateEnrollment}
            </Alert>
          )}
          <Grid container spacing={3}>
            {/* Student Selection */}
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={students}
                getOptionLabel={o => `${o.name} (${o.email || o.rollNumber || 'No ID'})`}
                value={selectedStudent}
                onChange={handleStudentChange}
                disabled={!!editingId}
                renderInput={params => (
                  <TextField {...params} label="Select Student *" size="small" required />
                )}
              />
            </Grid>

            {/* Course Selection */}
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={courses}
                getOptionLabel={o => `${o.name} (Fee: ${o.fee || 0})`}
                value={selectedCourse}
                onChange={handleCourseChange}
                disabled={!!editingId}
                renderInput={params => (
                  <TextField {...params} label="Select Course *" size="small" required />
                )}
              />
            </Grid>

            {/* Dates */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Enrollment Date"
                type="date"
                value={formData.enrollmentDate}
                onChange={e => setFormData(d => ({ ...d, enrollmentDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={e => setFormData(d => ({ ...d, startDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Fee Calculator */}
            <Grid item xs={12}>
              <FeeCalculator course={selectedCourse} formData={formData} setFormData={setFormData} />
            </Grid>

            {/* Admission Fee Toggle */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: alpha('#f59e0b', 0.03) }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.admissionFeeApplied}
                      onChange={e => setFormData(d => ({ ...d, admissionFeeApplied: e.target.checked }))}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={700}>Apply Admission Fee</Typography>
                      <Typography variant="caption" color="text.secondary">
                        One-time fee of {fmt(formData.admissionFee || 1000)} will be added to the first month's voucher only
                      </Typography>
                    </Box>
                  }
                />
                {formData.admissionFeeApplied && (
                  <TextField
                    size="small"
                    label="Admission Fee Amount"
                    type="number"
                    value={formData.admissionFee}
                    onChange={e => setFormData(d => ({ ...d, admissionFee: e.target.value }))}
                    InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
                    sx={{ ml: 4, width: 200, mt: 1 }}
                  />
                )}
              </Paper>
            </Grid>

            {/* Due Day & Notes */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Due Day of Month"
                type="number"
                value={formData.dueDay}
                onChange={e => setFormData(d => ({ ...d, dueDay: e.target.value }))}
                inputProps={{ min: 1, max: 31 }}
                helperText="Day when fee is due each month (default: 10th)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Notes (optional)"
                multiline
                rows={2}
                value={formData.notes}
                onChange={e => setFormData(d => ({ ...d, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.studentId || !formData.courseId || loading.createEnrollment || loading.updateEnrollment}
            sx={{ fontWeight: 700, minWidth: 140 }}
          >
            {loading.createEnrollment || loading.updateEnrollment ? (
              <CircularProgress size={20} />
            ) : editingId ? (
              'Save Changes'
            ) : (
              'Create Enrollment'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════ DELETE CONFIRM DIALOG ══════════════════════ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ color: 'error.main' }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this enrollment? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={loading.deleteEnrollment}>
            {loading.deleteEnrollment ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════ STATUS CHANGE DIALOG ══════════════════════ */}
      <Dialog open={statusDialogOpen} onClose={closeStatusDialog} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          {statusAction === 'drop' && 'Drop Course Enrollment'}
          {statusAction === 'complete' && 'Complete Course'}
          {statusAction === 'suspend' && 'Suspend Enrollment'}
          {statusAction === 'reactivate' && 'Reactivate Enrollment'}
        </DialogTitle>
        <DialogContent dividers>
          {errors.updateEnrollment && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError('updateEnrollment'))}>
              {errors.updateEnrollment}
            </Alert>
          )}
          <Grid container spacing={2}>
            {/* Show student and course info */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">Student</Typography>
                <Typography variant="body1" fontWeight={700}>{selectedEnrollment?.student?.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Course</Typography>
                <Typography variant="body1" fontWeight={700}>{selectedEnrollment?.course?.name}</Typography>
              </Paper>
            </Grid>

            {/* Status Display */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">Current Status:</Typography>
                <StatusChip status={selectedEnrollment?.status} />
                <Typography variant="body2" sx={{ mx: 1 }}>→</Typography>
                <StatusChip status={statusForm.status} />
              </Box>
            </Grid>

            {/* Drop-specific fields */}
            {statusAction === 'drop' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Drop Date"
                    type="date"
                    value={statusForm.dropDate}
                    onChange={e => setStatusForm(f => ({ ...f, dropDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Drop Reason"
                    value={statusForm.dropReason}
                    onChange={e => setStatusForm(f => ({ ...f, dropReason: e.target.value }))}
                    placeholder="e.g., Financial issues, personal reasons, course change..."
                    required
                  />
                </Grid>
              </>
            )}

            {/* Complete-specific fields */}
            {statusAction === 'complete' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Completion Date"
                  type="date"
                  value={statusForm.actualEndDate}
                  onChange={e => setStatusForm(f => ({ ...f, actualEndDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
            )}

            {/* Suspend-specific fields */}
            {statusAction === 'suspend' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Suspension Date"
                    type="date"
                    value={statusForm.suspensionDate}
                    onChange={e => setStatusForm(f => ({ ...f, suspensionDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Suspension Reason"
                    value={statusForm.suspensionReason}
                    onChange={e => setStatusForm(f => ({ ...f, suspensionReason: e.target.value }))}
                    placeholder="e.g., Medical leave, travel, other commitments..."
                    required
                  />
                </Grid>
              </>
            )}

            {/* Notes (for all actions) */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Additional Notes (optional)"
                multiline
                rows={2}
                value={statusForm.notes}
                onChange={e => setStatusForm(f => ({ ...f, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStatusDialog}>Cancel</Button>
          <Button
            variant="contained"
            color={statusAction === 'drop' ? 'error' : statusAction === 'complete' ? 'success' : 'primary'}
            onClick={submitStatusChange}
            disabled={loading.updateEnrollment || (statusAction === 'drop' && !statusForm.dropReason) || (statusAction === 'suspend' && !statusForm.suspensionReason)}
          >
            {loading.updateEnrollment ? <CircularProgress size={20} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default EnrollmentManagement;
