import React, { useState, useCallback } from 'react';
import {
  Box, Button, Typography, Grid, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  Checkbox, FormControlLabel, TextField, Divider, Avatar, Stack, Tooltip,
  LinearProgress, useTheme, alpha, Card, CardContent, CardHeader,
} from '@mui/material';
import WorkHistoryIcon   from '@mui/icons-material/WorkHistory';
import SaveIcon          from '@mui/icons-material/Save';
import RefreshIcon       from '@mui/icons-material/Refresh';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SchoolIcon        from '@mui/icons-material/School';
import moment            from 'moment';
import { toast }         from 'react-toastify';
import * as api          from '../services/api';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

const ClassPayrollTab = ({ companyId }) => {
  const theme = useTheme();

  // ── Daily log state ──────────────────────────────────────────────────────
  const [date,        setDate]        = useState(moment().format('YYYY-MM-DD'));
  const [logData,     setLogData]     = useState([]);   // [{teacher, batches:[]}]
  const [loading,     setLoading]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);
  // selections: { teacherId -> Set<batchId> }
  const [selections,  setSelections]  = useState({});
  // saving per teacher: { teacherId -> bool }
  const [saving,      setSaving]      = useState({});

  // ── Monthly summary state ────────────────────────────────────────────────
  const [month,          setMonth]          = useState(moment().format('YYYY-MM'));
  const [summary,        setSummary]        = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [genPayroll,     setGenPayroll]     = useState(false);

  // ── Load daily class log ─────────────────────────────────────────────────
  const loadClassLogs = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const { data } = await api.fetchClassLogs(companyId, date);
      setLogData(data);
      const sel = {};
      data.forEach(row => {
        sel[row.teacher._id] = new Set(
          row.batches.filter(b => b.logged).map(b => b._id)
        );
      });
      setSelections(sel);
      setLoaded(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load class log');
    } finally {
      setLoading(false);
    }
  }, [companyId, date]);

  // ── Toggle a batch checkbox ──────────────────────────────────────────────
  const handleToggle = (teacherId, batchId) => {
    setSelections(prev => {
      const next = { ...prev };
      const s = new Set(next[teacherId] || []);
      s.has(batchId) ? s.delete(batchId) : s.add(batchId);
      next[teacherId] = s;
      return next;
    });
  };

  // ── Save one teacher's class log ─────────────────────────────────────────
  const handleSave = async (teacherId) => {
    setSaving(prev => ({ ...prev, [teacherId]: true }));
    try {
      await api.saveClassLogs({
        companyId,
        teacherId,
        date,
        batchIds: [...(selections[teacherId] || [])],
      });
      toast.success('Class log saved');
      await loadClassLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(prev => ({ ...prev, [teacherId]: false }));
    }
  };

  // ── Monthly summary ──────────────────────────────────────────────────────
  const loadSummary = async () => {
    if (!companyId) return;
    setLoadingSummary(true);
    try {
      const { data } = await api.fetchMonthlyClassSummary(companyId, month);
      setSummary(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  // ── Generate payroll from logs ───────────────────────────────────────────
  const handleGeneratePayroll = async () => {
    if (!companyId) return;
    setGenPayroll(true);
    try {
      const { data } = await api.generatePayrollFromLogs(companyId, month);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payroll generation failed');
    } finally {
      setGenPayroll(false);
    }
  };

  return (
    <Box sx={{ p: 2.5 }}>

      {/* ══ SECTION 1: Daily Class Log ══════════════════════════════════════ */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <WorkHistoryIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Daily Class Log</Typography>
        <Chip label="Per-class teachers only" size="small" color="primary" variant="outlined" />
      </Stack>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2, py: 0.5 }}>
        Only teachers who are <strong>marked Present</strong> today AND have <strong>per-class salary</strong> appear here.
        Check which classes they actually taught, then save.
      </Alert>

      {/* Date picker + Load */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth size="small" label="Date" type="date"
            value={date} onChange={e => { setDate(e.target.value); setLoaded(false); }}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item>
          <Button
            variant="contained" startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
            onClick={loadClassLogs} disabled={loading}
          >
            {loading ? 'Loading...' : 'Load Teachers'}
          </Button>
        </Grid>
      </Grid>

      {/* Teacher cards */}
      {loaded && logData.length === 0 && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          No per-class teachers are marked <strong>Present</strong> on {moment(date).format('DD MMM YYYY')}.
          Mark attendance first (Mark Attendance tab), then come back here.
        </Alert>
      )}

      {logData.map(row => {
        const sel      = selections[row.teacher._id] || new Set();
        const daily    = row.batches.reduce((sum, b) => sel.has(b._id) ? sum + (b.ratePerClass || 0) : sum, 0);
        const isSaving = saving[row.teacher._id];

        return (
          <Card
            key={row.teacher._id}
            variant="outlined"
            sx={{ mb: 2, borderRadius: 2, borderColor: daily > 0 ? alpha(theme.palette.success.main, 0.4) : 'divider' }}
          >
            <CardHeader
              avatar={
                <Avatar sx={{ bgcolor: theme.palette.primary.main, fontWeight: 700 }}>
                  {row.teacher.name?.charAt(0)}
                </Avatar>
              }
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontWeight={700}>{row.teacher.name}</Typography>
                  <Chip label={row.teacher.salaryType === 'hybrid' ? 'Hybrid' : 'Per Class'} size="small" color="info" />
                </Stack>
              }
              subheader={row.teacher.email || ''}
              action={
                <Stack direction="row" spacing={1} alignItems="center" pr={1}>
                  {daily > 0 && (
                    <Chip
                      label={`Today: Rs. ${fmt(daily)}`}
                      color="success" variant="filled"
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                  <Button
                    variant="contained" size="small"
                    startIcon={isSaving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon />}
                    onClick={() => handleSave(row.teacher._id)}
                    disabled={isSaving}
                    color="success"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </Stack>
              }
              sx={{ pb: 0, borderBottom: '1px solid', borderColor: 'divider' }}
            />
            <CardContent sx={{ pt: 1.5 }}>
              {row.batches.length === 0 ? (
                <Alert severity="warning" sx={{ borderRadius: 1, py: 0.5 }}>
                  No active batches assigned to this teacher. Assign batches in the Batches page.
                </Alert>
              ) : (
                <Grid container spacing={1}>
                  {row.batches.map(batch => {
                    const checked = sel.has(batch._id);
                    return (
                      <Grid item xs={12} sm={6} md={4} key={batch._id}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5, borderRadius: 2, cursor: 'pointer',
                            borderColor: checked ? theme.palette.success.main : 'divider',
                            bgcolor: checked ? alpha(theme.palette.success.main, 0.06) : 'background.paper',
                            transition: 'all 0.15s',
                            '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) },
                          }}
                          onClick={() => handleToggle(row.teacher._id, batch._id)}
                        >
                          <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <Checkbox
                              checked={checked} size="small"
                              color="success" sx={{ p: 0 }}
                              onChange={() => handleToggle(row.teacher._id, batch._id)}
                              onClick={e => e.stopPropagation()}
                            />
                            <Box>
                              <Typography variant="body2" fontWeight={700} color={checked ? 'success.dark' : 'text.primary'}>
                                {batch.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                <SchoolIcon sx={{ fontSize: 11, mr: 0.3, verticalAlign: 'middle' }} />
                                {batch.course?.name || 'Unknown Course'}
                              </Typography>
                              <Typography variant="caption" display="block" color={checked ? 'success.main' : 'primary.main'} fontWeight={700}>
                                Rs. {fmt(batch.ratePerClass)} / class
                              </Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Divider sx={{ my: 3 }} />

      {/* ══ SECTION 2: Monthly Summary ══════════════════════════════════════ */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <AccountBalanceIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Monthly Class Summary</Typography>
      </Stack>

      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth size="small" label="Month" type="month"
            value={month} onChange={e => setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item>
          <Button
            variant="outlined"
            startIcon={loadingSummary ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={loadSummary} disabled={loadingSummary}
          >
            {loadingSummary ? 'Loading...' : 'Load Summary'}
          </Button>
        </Grid>
        {summary.length > 0 && (
          <Grid item>
            <Button
              variant="contained" color="success"
              startIcon={genPayroll ? <CircularProgress size={14} color="inherit" /> : <AccountBalanceIcon />}
              onClick={handleGeneratePayroll} disabled={genPayroll}
            >
              {genPayroll ? 'Generating...' : 'Generate Payroll (Draft)'}
            </Button>
          </Grid>
        )}
      </Grid>

      {summary.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Teacher</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Classes Taught</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Rate / Class</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.map((teacher, ti) => (
                <React.Fragment key={teacher._id}>
                  {teacher.breakdown.map((row, ri) => (
                    <TableRow key={ri} hover>
                      {ri === 0 && (
                        <TableCell rowSpan={teacher.breakdown.length + 1} sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 30, height: 30, fontSize: 13, bgcolor: theme.palette.primary.main }}>
                              {teacher.name?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2" fontWeight={700}>{teacher.name}</Typography>
                          </Stack>
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip label={row.courseName} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight={700} color="primary">{row.classCount}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        Rs. {fmt(row.ratePerClass)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Rs. {fmt(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Teacher total row */}
                  <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.06) }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 700, color: 'success.dark', borderTop: '1px solid', borderColor: alpha(theme.palette.success.main, 0.3) }}>
                      Total — {teacher.name}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: 'success.dark', borderTop: '1px solid', borderColor: alpha(theme.palette.success.main, 0.3) }}>
                      {teacher.totalClasses}
                    </TableCell>
                    <TableCell sx={{ borderTop: '1px solid', borderColor: alpha(theme.palette.success.main, 0.3) }} />
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'success.dark', borderTop: '1px solid', borderColor: alpha(theme.palette.success.main, 0.3) }}>
                      Rs. {fmt(teacher.totalAmount)}
                    </TableCell>
                  </TableRow>
                  {ti < summary.length - 1 && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ p: 0, borderBottom: '2px solid', borderColor: 'divider' }} />
                    </TableRow>
                  )}
                </React.Fragment>
              ))}

              {/* Grand total */}
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                <TableCell colSpan={3} sx={{ fontWeight: 800, fontSize: 14 }}>GRAND TOTAL</TableCell>
                <TableCell />
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: 14, color: 'primary.dark' }}>
                  Rs. {fmt(summary.reduce((s, t) => s + (t.totalAmount || 0), 0))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loadingSummary && summary.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Select a month and click Load Summary to see class counts and salary breakdown.
        </Alert>
      )}
    </Box>
  );
};

export default ClassPayrollTab;
