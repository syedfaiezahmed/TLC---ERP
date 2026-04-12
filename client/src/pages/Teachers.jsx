import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getTeachers, createTeacher, updateTeacher, deleteTeacher } from '../redux/teacherSlice';
import * as api from '../services/api';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Avatar, Card, useTheme, alpha, CircularProgress,
  Chip, MenuItem, Select, FormControl, InputLabel, Divider, Tooltip, Grid,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon,
  Delete as DeleteIcon, School as SchoolIcon, Warning as WarningIcon,
} from '@mui/icons-material';

const SALARY_TYPES = [
  { value: 'fixed', label: 'Fixed Salary' },
  { value: 'per_class', label: 'Per Class Rate' },
  { value: 'commission', label: 'Commission (% of Fees)' },
  { value: 'hybrid', label: 'Hybrid (Mixed)' },
];

const salaryTypeColor = { fixed: 'primary', per_class: 'success', commission: 'warning', hybrid: 'secondary' };

const emptyForm = () => ({
  name: '', email: '', contact: '', address: '', specialization: '',
  openingBalance: '', openingBalanceDate: '',
  salaryType: 'fixed',
  annualSalary: '', fixedSalary: '',
  perClassRates: [],
  commissionRates: [],
  bankDetails: { accountName: '', accountNumber: '', bankName: '' },
});

const Teachers = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { companyId } = useParams();

  const { teachers, loading } = useSelector((state) => state.teachers);

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [courses, setCourses] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      dispatch(getTeachers({ companyId, params: {} }));
      api.fetchCourses(companyId).then(r => setCourses(r.data?.courses || [])).catch(() => {});
    }
  }, [dispatch, companyId]);

  const filtered = (teachers || []).filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.contact && t.contact.includes(searchTerm))
  );

  const openCreate = () => { setFormData(emptyForm()); setEditMode(false); setEditId(null); setDialogOpen(true); };

  const openEdit = (t) => {
    setFormData({
      name: t.name || '', email: t.email || '', contact: t.contact || '',
      address: t.address || '', specialization: t.specialization || '',
      openingBalance: '', openingBalanceDate: '',
      salaryType: t.salaryType || 'fixed',
      annualSalary: t.annualSalary || '',
      fixedSalary: t.fixedSalary || '',
      perClassRates: (t.perClassRates || []).map(r => ({ course: r.course?._id || r.course || '', ratePerClass: r.ratePerClass || 0 })),
      commissionRates: (t.commissionRates || []).map(r => ({ course: r.course?._id || r.course || '', percentage: r.percentage || 0 })),
      bankDetails: t.bankDetails || { accountName: '', accountNumber: '', bankName: '' },
    });
    setEditMode(true); setEditId(t._id); setDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await dispatch(deleteTeacher(confirmDelete._id)).unwrap();
      toast.success('Teacher deleted');
    } catch (e) { toast.error(e?.message || 'Delete failed'); }
    setConfirmDelete(null);
  };

  const handleChange = (field, value) => setFormData(f => ({ ...f, [field]: value }));

  const addPerClassRate = () => setFormData(f => ({ ...f, perClassRates: [...f.perClassRates, { course: '', ratePerClass: 0 }] }));
  const removePerClassRate = (i) => setFormData(f => ({ ...f, perClassRates: f.perClassRates.filter((_, idx) => idx !== i) }));
  const updatePerClassRate = (i, field, val) => setFormData(f => {
    const arr = [...f.perClassRates]; arr[i] = { ...arr[i], [field]: val }; return { ...f, perClassRates: arr };
  });

  const addCommissionRate = () => setFormData(f => ({ ...f, commissionRates: [...f.commissionRates, { course: '', percentage: 0 }] }));
  const removeCommissionRate = (i) => setFormData(f => ({ ...f, commissionRates: f.commissionRates.filter((_, idx) => idx !== i) }));
  const updateCommissionRate = (i, field, val) => setFormData(f => {
    const arr = [...f.commissionRates]; arr[i] = { ...arr[i], [field]: val }; return { ...f, commissionRates: arr };
  });

  const monthlySalary = () => {
    const annual = Number(formData.annualSalary || 0);
    if (annual > 0) return (annual / 12).toFixed(2);
    return Number(formData.fixedSalary || 0).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.contact) return toast.error('Name and contact are required');
    setSaving(true);
    try {
      const payload = {
        ...formData,
        companyId,
        perClassRates: formData.perClassRates.filter(r => r.course && r.course !== ''),
        commissionRates: formData.commissionRates.filter(r => r.course && r.course !== ''),
      };
      if (editMode) {
        await dispatch(updateTeacher({ id: editId, teacherData: payload })).unwrap();
        toast.success('Teacher updated');
      } else {
        await dispatch(createTeacher(payload)).unwrap();
        toast.success('Teacher added');
      }
      setDialogOpen(false);
    } catch (e) { toast.error(e?.message || 'Failed to save teacher'); }
    setSaving(false);
  };

  const showFixed = ['fixed', 'hybrid'].includes(formData.salaryType);
  const showPerClass = ['per_class', 'hybrid'].includes(formData.salaryType);
  const showCommission = ['commission', 'hybrid'].includes(formData.salaryType);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Faculty / Teachers</Typography>
          <Typography variant="body2" color="text.secondary">Manage staff profiles and salary structures</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ fontWeight: 700 }}>
          Add Teacher
        </Button>
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <TextField size="small" placeholder="Search by name or contact..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} sx={{ width: 300 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        </Box>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Teacher</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Specialization</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Salary Structure</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Monthly Salary</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : filtered.map(t => {
                const monthly = t.annualSalary > 0 ? t.annualSalary / 12 : (t.fixedSalary || 0);
                return (
                  <TableRow key={t._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontWeight: 700, fontSize: '0.9rem' }}>
                          {t.name[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={700} variant="body2">{t.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{t.email || '—'}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2">{t.contact}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{t.specialization || '—'}</Typography></TableCell>
                    <TableCell>
                      <Chip size="small" label={SALARY_TYPES.find(s => s.value === t.salaryType)?.label || t.salaryType}
                        color={salaryTypeColor[t.salaryType] || 'default'}
                        sx={{ fontWeight: 700, fontSize: '0.7rem', borderRadius: 1 }} />
                      {t.annualSalary > 0 && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Annual: PKR {Number(t.annualSalary).toLocaleString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {(t.salaryType === 'fixed' || t.salaryType === 'hybrid') && monthly > 0 ? (
                        <Typography fontWeight={700} color="primary.main">
                          PKR {Math.round(monthly).toLocaleString()}/mo
                        </Typography>
                      ) : t.salaryType === 'per_class' ? (
                        <Typography variant="body2" color="success.main" fontWeight={600}>
                          {(t.perClassRates || []).length} class rate(s)
                        </Typography>
                      ) : t.salaryType === 'commission' ? (
                        <Typography variant="body2" color="warning.main" fontWeight={600}>
                          {(t.commissionRates || []).length} commission rate(s)
                        </Typography>
                      ) : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit Teacher"><IconButton size="small" color="primary" onClick={() => openEdit(t)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete Teacher"><IconButton size="small" color="error" onClick={() => setConfirmDelete(t)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                  <SchoolIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">No teachers found</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>
          {editMode ? 'Edit Teacher' : 'Add New Teacher'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>Basic Information</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}><TextField label="Full Name *" fullWidth required value={formData.name} onChange={e => handleChange('name', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Contact Number *" fullWidth required value={formData.contact} onChange={e => handleChange('contact', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Email" fullWidth value={formData.email} onChange={e => handleChange('email', e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Specialization (e.g. Physics, Maths)" fullWidth value={formData.specialization} onChange={e => handleChange('specialization', e.target.value)} /></Grid>
              <Grid item xs={12}><TextField label="Address" fullWidth multiline rows={2} value={formData.address} onChange={e => handleChange('address', e.target.value)} /></Grid>
              {!editMode && (
                <>
                  <Grid item xs={12} sm={6}><TextField label="Opening Balance (Payable to teacher)" type="number" fullWidth value={formData.openingBalance} onChange={e => handleChange('openingBalance', e.target.value)} /></Grid>
                  <Grid item xs={12} sm={6}><TextField label="Opening Balance Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={formData.openingBalanceDate} onChange={e => handleChange('openingBalanceDate', e.target.value)} /></Grid>
                </>
              )}
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>
              💰 Salary Structure
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Salary Type *</InputLabel>
              <Select value={formData.salaryType} label="Salary Type *" onChange={e => handleChange('salaryType', e.target.value)}>
                {SALARY_TYPES.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>

            {/* Fixed Salary */}
            {showFixed && (
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2, mb: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Fixed Salary Configuration</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField label="Annual Salary (PKR)" type="number" fullWidth value={formData.annualSalary}
                      onChange={e => handleChange('annualSalary', e.target.value)}
                      helperText="Enter annual contract salary — monthly will be calculated automatically" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, textAlign: 'center', border: `1px dashed ${theme.palette.primary.main}` }}>
                      <Typography variant="caption" color="text.secondary">Monthly Salary</Typography>
                      <Typography variant="h6" fontWeight={800} color="primary.main">
                        PKR {Number(monthlySalary()).toLocaleString()}
                      </Typography>
                      {Number(formData.annualSalary) > 0 && (
                        <Typography variant="caption" color="text.secondary">Annual ÷ 12</Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Per-Class Rates */}
            {showPerClass && (
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.04), borderRadius: 2, mb: 2, border: `1px solid ${alpha(theme.palette.success.main, 0.15)}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={700}>Per-Class Rates (by Course/Grade)</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addPerClassRate} variant="outlined" color="success">Add Rate</Button>
                </Box>
                {formData.perClassRates.length === 0 && (
                  <Typography variant="caption" color="text.secondary">No rates added yet. Click "Add Rate" to configure.</Typography>
                )}
                {formData.perClassRates.map((r, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ flex: 2 }}>
                      <InputLabel>Class / Course</InputLabel>
                      <Select value={r.course} label="Class / Course" onChange={e => updatePerClassRate(i, 'course', e.target.value)}>
                        {courses.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField size="small" label="Rate per Class (PKR)" type="number" sx={{ flex: 1 }}
                      value={r.ratePerClass} onChange={e => updatePerClassRate(i, 'ratePerClass', e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }} />
                    <IconButton size="small" color="error" onClick={() => removePerClassRate(i)}><DeleteIcon fontSize="small" /></IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {/* Commission Rates */}
            {showCommission && (
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.04), borderRadius: 2, mb: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={700}>Commission Rates (% of Fee Collected per Course)</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addCommissionRate} variant="outlined" color="warning">Add Rate</Button>
                </Box>
                {formData.commissionRates.length === 0 && (
                  <Typography variant="caption" color="text.secondary">No commission rates yet. Click "Add Rate" to configure.</Typography>
                )}
                {formData.commissionRates.map((r, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ flex: 2 }}>
                      <InputLabel>Class / Course</InputLabel>
                      <Select value={r.course} label="Class / Course" onChange={e => updateCommissionRate(i, 'course', e.target.value)}>
                        {courses.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField size="small" label="Commission %" type="number" sx={{ flex: 1 }}
                      value={r.percentage} onChange={e => updateCommissionRate(i, 'percentage', e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                      inputProps={{ min: 0, max: 100 }} />
                    <IconButton size="small" color="error" onClick={() => removeCommissionRate(i)}><DeleteIcon fontSize="small" /></IconButton>
                  </Box>
                ))}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>🏦 Bank Details (Optional)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}><TextField label="Account Holder Name" fullWidth size="small" value={formData.bankDetails?.accountName || ''} onChange={e => handleChange('bankDetails', { ...formData.bankDetails, accountName: e.target.value })} /></Grid>
              <Grid item xs={12} sm={4}><TextField label="Bank Name" fullWidth size="small" value={formData.bankDetails?.bankName || ''} onChange={e => handleChange('bankDetails', { ...formData.bankDetails, bankName: e.target.value })} /></Grid>
              <Grid item xs={12} sm={4}><TextField label="Account Number" fullWidth size="small" value={formData.bankDetails?.accountNumber || ''} onChange={e => handleChange('bankDetails', { ...formData.bankDetails, accountNumber: e.target.value })} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving} sx={{ fontWeight: 700, px: 3 }}>
              {saving ? <CircularProgress size={18} color="inherit" /> : editMode ? 'Update Teacher' : 'Add Teacher'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main', fontWeight: 700 }}><WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Delete Teacher</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Teachers;
