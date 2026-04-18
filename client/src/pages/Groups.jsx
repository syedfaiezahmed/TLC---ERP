import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  getGroups, createGroup, updateGroup, deleteGroup, seedGroups, clearGroupError,
} from '../redux/groupSlice';
import {
  Container, Paper, Typography, TextField, Button, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogActions, DialogContent, DialogTitle, Alert, Box, InputAdornment,
  Tooltip, Chip, useTheme, alpha, MenuItem, Stack, CircularProgress,
  LinearProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import LayersIcon from '@mui/icons-material/Layers';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SchoolIcon from '@mui/icons-material/School';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import BookIcon from '@mui/icons-material/Book';
import StatCard from '../components/StatCard';

const LEVELS = ['Primary', 'Matric', 'Intermediate', 'Bachelor', 'Master', 'Diploma', 'Other'];

const PRESET_COLORS = [
  '#1976d2', '#2e7d32', '#6a1b9a', '#ef6c00',
  '#c2185b', '#00838f', '#5d4037', '#0277bd',
];

const LevelChip = ({ level }) => {
  const theme = useTheme();
  const colorMap = {
    Primary: theme.palette.info.light,
    Matric: theme.palette.warning.light,
    Intermediate: theme.palette.primary.light,
    Bachelor: theme.palette.secondary.light,
    Master: theme.palette.error.light,
    Diploma: theme.palette.success.light,
    Other: theme.palette.grey[400],
  };
  return (
    <Chip
      label={level || 'Other'}
      size="small"
      sx={{ bgcolor: alpha(colorMap[level] || theme.palette.grey[400], 0.25), fontWeight: 600, borderRadius: 1 }}
    />
  );
};

const empty = {
  name: '', code: '', level: 'Intermediate', description: '',
  subjects: '', color: '#1976d2', displayOrder: 0, status: 'active',
};

const Groups = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { companyId: routeCompanyId } = useParams();
  const { selectedCompany } = useSelector((s) => s.companies);
  const { groups, loading, error } = useSelector((s) => s.groups);

  const companyId = routeCompanyId || selectedCompany?._id;

  const [formData, setFormData] = useState(empty);
  const [currentId, setCurrentId] = useState(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (companyId) dispatch(getGroups(companyId));
  }, [dispatch, companyId]);

  const filtered = useMemo(() => {
    return (groups || []).filter((g) => {
      const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.code || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchLevel = filterLevel === 'all' || g.level === filterLevel;
      return matchSearch && matchLevel;
    });
  }, [groups, searchTerm, filterLevel]);

  const stats = useMemo(() => ({
    total: (groups || []).length,
    active: (groups || []).filter((g) => g.status === 'active').length,
    totalCourses: (groups || []).reduce((s, g) => s + (g.courseCount || 0), 0),
    totalStudents: (groups || []).reduce((s, g) => s + (g.studentCount || 0), 0),
  }), [groups]);

  const handleOpen = (group = null) => {
    if (group) {
      setCurrentId(group._id);
      setFormData({
        name: group.name || '',
        code: group.code || '',
        level: group.level || 'Intermediate',
        description: group.description || '',
        subjects: Array.isArray(group.subjects) ? group.subjects.join(', ') : '',
        color: group.color || '#1976d2',
        displayOrder: group.displayOrder || 0,
        status: group.status || 'active',
      });
    } else {
      setCurrentId(null);
      setFormData(empty);
    }
    setLocalError('');
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setLocalError(''); };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setLocalError('Group name is required.'); return; }
    setActionLoading(true);
    setLocalError('');
    try {
      const payload = {
        ...formData,
        companyId,
        subjects: formData.subjects
          ? formData.subjects.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        displayOrder: Number(formData.displayOrder) || 0,
      };
      if (currentId) {
        await dispatch(updateGroup({ id: currentId, group: payload })).unwrap();
      } else {
        await dispatch(createGroup(payload)).unwrap();
      }
      handleClose();
    } catch (err) {
      setLocalError(err?.message || 'Failed to save group.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete group "${name}"? Courses and students assigned to this group will be unlinked.`)) return;
    await dispatch(deleteGroup(id));
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      await dispatch(seedGroups(companyId)).unwrap();
    } catch (_) {}
    setSeedLoading(false);
  };

  if (!companyId) {
    return (
      <Box p={3}>
        <Alert severity="warning">Please select an institute from the Dashboard first.</Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5, letterSpacing: -0.5 }}>
              Academic Groups
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organize courses &amp; students by academic stream — Pre-Engineering, Pre-Medical, Commerce, etc.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
              <Button
                variant="outlined"
                startIcon={seedLoading ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                onClick={handleSeed}
                disabled={seedLoading}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Seed Defaults
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpen()}
                sx={{ borderRadius: 2, textTransform: 'none', px: 3, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
              >
                Add Group
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Error */}
      {(error) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearGroupError())}>
          {error}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total Groups" value={stats.total} icon={<LayersIcon />} color={theme.palette.primary.main} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Active Groups" value={stats.active} icon={<LayersIcon />} color={theme.palette.success.main} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Linked Courses" value={stats.totalCourses} icon={<BookIcon />} color={theme.palette.secondary.main} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Linked Students" value={stats.totalStudents} icon={<PeopleAltIcon />} color={theme.palette.info.main} />
        </Grid>
      </Grid>

      {/* Table */}
      <Paper sx={{ borderRadius: 4, boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {/* Filters */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <TextField
                fullWidth size="small"
                placeholder="Search groups by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment>,
                  sx: { borderRadius: 2, bgcolor: 'white' },
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select fullWidth size="small" value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                InputProps={{ sx: { borderRadius: 2, bgcolor: 'white' } }}
              >
                <MenuItem value="all">All Levels</MenuItem>
                {LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </Box>

        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['', 'Group Name', 'Code', 'Level', 'Subjects', 'Courses', 'Students', 'Status', 'Actions'].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((g) => (
                <TableRow key={g._id} hover>
                  {/* Color swatch */}
                  <TableCell sx={{ py: 0.5, width: 8, pr: 0 }}>
                    <Box sx={{ width: 6, height: 36, borderRadius: 1, bgcolor: g.color || '#1976d2' }} />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={700}>{g.name}</Typography>
                    {g.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    {g.code ? (
                      <Chip label={g.code} size="small" sx={{ fontWeight: 700, bgcolor: alpha(g.color || '#1976d2', 0.12), color: g.color || 'primary.main', borderRadius: 1 }} />
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}><LevelChip level={g.level} /></TableCell>
                  <TableCell sx={{ py: 0.5, maxWidth: 200 }}>
                    {(g.subjects || []).length > 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.subjects.join(' · ')}
                      </Typography>
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Chip label={g.courseCount || 0} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, minWidth: 36 }} />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Chip label={g.studentCount || 0} size="small" color="info" variant="outlined" sx={{ fontWeight: 700, minWidth: 36 }} />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Chip
                      label={g.status === 'active' ? 'Active' : 'Inactive'}
                      size="small"
                      color={g.status === 'active' ? 'success' : 'default'}
                      sx={{ fontWeight: 600, borderRadius: 1 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Edit Group">
                        <IconButton onClick={() => handleOpen(g)} size="small"
                          sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', p: 0.5, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } }}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Group">
                        <IconButton onClick={() => handleDelete(g._id, g.name)} size="small"
                          sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', p: 0.5, '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}>
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                      <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                      <Typography color="text.secondary">
                        {groups.length === 0
                          ? 'No groups yet. Click "Seed Defaults" to add standard Pakistani academic groups.'
                          : 'No groups match your search.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{currentId ? 'Edit Group' : 'Add New Group'}</DialogTitle>
        <DialogContent dividers>
          {localError && <Alert severity="error" sx={{ mb: 2 }}>{localError}</Alert>}
          <Box component="form" noValidate>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField name="name" label="Group Name *" fullWidth size="small"
                  value={formData.name} onChange={handleChange} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField name="code" label="Short Code (e.g. PRE-ENG)" fullWidth size="small"
                  value={formData.code} onChange={handleChange}
                  inputProps={{ style: { textTransform: 'uppercase' } }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select name="level" label="Level" fullWidth size="small"
                  value={formData.level} onChange={handleChange}>
                  {LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select name="status" label="Status" fullWidth size="small"
                  value={formData.status} onChange={handleChange}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField name="description" label="Description" fullWidth size="small"
                  multiline rows={2} value={formData.description} onChange={handleChange} />
              </Grid>
              <Grid item xs={12}>
                <TextField name="subjects" label="Core Subjects (comma-separated)" fullWidth size="small"
                  placeholder="e.g. Physics, Chemistry, Mathematics"
                  value={formData.subjects} onChange={handleChange} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField name="displayOrder" label="Display Order" type="number" fullWidth size="small"
                  value={formData.displayOrder} onChange={handleChange}
                  inputProps={{ min: 0 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Badge Color</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {PRESET_COLORS.map((c) => (
                      <Box key={c} onClick={() => setFormData({ ...formData, color: c })}
                        sx={{
                          width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                          border: formData.color === c ? `3px solid ${theme.palette.text.primary}` : '3px solid transparent',
                          transition: 'border 0.15s',
                        }} />
                    ))}
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={actionLoading}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" sx={{ px: 3, boxShadow: 'none' }}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={18} color="inherit" /> : null}>
            {actionLoading ? 'Saving...' : currentId ? 'Save Changes' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Groups;
