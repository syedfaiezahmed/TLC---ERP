import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  getAttendance, markAttendanceBulk, deleteAttendanceRecord,
  getMonthlyRegister, getAttendanceReport, getAttendanceStats,
} from '../redux/attendanceSlice';
import { getBatches } from '../redux/batchSlice';
import { getTeachers } from '../redux/teacherSlice';
import {
  Container, Paper, Typography, TextField, Button, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Box, useTheme, alpha,
  MenuItem, FormControl, InputLabel, Select, RadioGroup, FormControlLabel,
  Radio, CircularProgress, Alert, Stack, Avatar, Tabs, Tab,
  Chip, Tooltip, IconButton, LinearProgress,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import moment from 'moment';
import { toast } from 'react-toastify';

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_COLORS = { Present: 'success', Absent: 'error', Late: 'warning', Excused: 'info' };
const STATUS_SHORT  = { Present: 'P', Absent: 'A', Late: 'L', Excused: 'E' };
const STATUS_BG     = { Present: '#E8F5E9', Absent: '#FFEBEE', Late: '#FFF8E1', Excused: '#E3F2FD' };
const STATUS_TXT    = { Present: '#2E7D32', Absent: '#C62828', Late: '#E65100', Excused: '#1565C0' };

const StatusChip = ({ status }) => (
  <Chip label={status} color={STATUS_COLORS[status] || 'default'} size="small"
    sx={{ fontWeight: 700, minWidth: 72, fontSize: 11 }} />
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Attendance = () => {
  const dispatch  = useDispatch();
  const theme     = useTheme();
  const { companyId } = useParams();

  // Redux state
  const { batches }  = useSelector(s => s.batches);
  const { teachers } = useSelector(s => s.teachers);
  const { records: attendanceLogs, loading, saving, monthlyRegister, loadingRegister, report, loadingReport } =
    useSelector(s => s.attendance);

  // ── Shared filters ──────────────────────────────────────────────────────────
  const [mainTab,        setMainTab]        = useState(0);
  const [type,           setType]           = useState('Student');
  const [selectedBatch,  setSelectedBatch]  = useState('');

  // ── Tab 0: Mark Attendance ──────────────────────────────────────────────────
  const [markDate,   setMarkDate]   = useState(moment().format('YYYY-MM-DD'));
  const [markRows,   setMarkRows]   = useState([]);

  // ── Tab 1: Monthly Register ─────────────────────────────────────────────────
  const [regMonth,   setRegMonth]   = useState(moment().format('YYYY-MM'));

  // ── Tab 2: Report ───────────────────────────────────────────────────────────
  const [rptStart,   setRptStart]   = useState(moment().startOf('month').format('YYYY-MM-DD'));
  const [rptEnd,     setRptEnd]     = useState(moment().format('YYYY-MM-DD'));

  // ── Load data on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (companyId) {
      dispatch(getBatches(companyId));
      dispatch(getTeachers(companyId));
    }
  }, [dispatch, companyId]);

  // ── Tab 0: load existing records + build rows ───────────────────────────────
  useEffect(() => {
    if (mainTab !== 0) return;
    const params = { date: markDate, type };
    if (type === 'Student' && selectedBatch) params.batch = selectedBatch;
    dispatch(getAttendance(params));
  }, [dispatch, mainTab, markDate, type, selectedBatch]);

  useEffect(() => {
    if (mainTab !== 0) return;
    if (type === 'Student') {
      if (!selectedBatch) { setMarkRows([]); return; }
      const batch = batches.find(b => b._id === selectedBatch);
      const batchStudents = batch?.students || [];
      setMarkRows(batchStudents.map(s => {
        const ex = attendanceLogs.find(l => l.student?._id === s._id || l.student === s._id);
        return { student: s._id, name: s.name, info: s.studentId || s.email, status: ex?.status || 'Present', remarks: ex?.remarks || '', dbId: ex?._id };
      }));
    } else {
      setMarkRows(teachers.map(t => {
        const ex = attendanceLogs.find(l => l.teacher?._id === t._id || l.teacher === t._id);
        return { teacher: t._id, name: t.name, info: t.email, status: ex?.status || 'Present', remarks: ex?.remarks || '', dbId: ex?._id };
      }));
    }
  }, [type, selectedBatch, batches, teachers, attendanceLogs, mainTab]);

  const handleStatusChange = (idx, status) => setMarkRows(r => r.map((x, i) => i === idx ? { ...x, status } : x));
  const handleRemarksChange = (idx, v) => setMarkRows(r => r.map((x, i) => i === idx ? { ...x, remarks: v } : x));
  const handleMarkAll = (status) => setMarkRows(r => r.map(x => ({ ...x, status })));

  const handleSave = async () => {
    if (!markDate || (type === 'Student' && !selectedBatch && markRows.length === 0)) {
      toast.error('Please select a batch first'); return;
    }
    try {
      await dispatch(markAttendanceBulk({
        date: markDate, type,
        batch: type === 'Student' ? selectedBatch : undefined,
        records: markRows.map(r => ({ student: r.student, teacher: r.teacher, status: r.status, remarks: r.remarks })),
      })).unwrap();
      toast.success(`Attendance saved for ${markRows.length} ${type === 'Student' ? 'students' : 'teachers'}`);
      dispatch(getAttendance({ date: markDate, type, ...(type === 'Student' && selectedBatch ? { batch: selectedBatch } : {}) }));
    } catch (e) { toast.error(e?.message || 'Failed to save attendance'); }
  };

  const handleDeleteRecord = (id) => {
    if (!window.confirm('Delete this attendance record?')) return;
    dispatch(deleteAttendanceRecord(id)).then(() => toast.success('Record deleted'));
  };

  // ── Tab 1: Monthly Register ─────────────────────────────────────────────────
  const loadRegister = useCallback(() => {
    const [y, m] = regMonth.split('-');
    const params = { year: y, month: m, type };
    if (type === 'Student' && selectedBatch) params.batch = selectedBatch;
    dispatch(getMonthlyRegister(params));
  }, [dispatch, regMonth, type, selectedBatch]);

  useEffect(() => { if (mainTab === 1) loadRegister(); }, [mainTab, loadRegister]);

  const exportRegisterCSV = () => {
    if (!monthlyRegister) return;
    const { days, persons } = monthlyRegister;
    const header = ['Name', 'ID', ...days.map(d => `Day ${d}`), 'Present', 'Absent', 'Late', 'Excused', '%'];
    const rows = persons.map(p => {
      const dayCells = days.map(d => STATUS_SHORT[p.days[d]?.status] || '-');
      const tot = days.filter(d => p.days[d]).length;
      const pr  = days.filter(d => p.days[d]?.status === 'Present').length;
      const ab  = days.filter(d => p.days[d]?.status === 'Absent').length;
      const lt  = days.filter(d => p.days[d]?.status === 'Late').length;
      const ex  = days.filter(d => p.days[d]?.status === 'Excused').length;
      const pct = tot > 0 ? ((pr + lt) / tot * 100).toFixed(1) : '0.0';
      return [p.name, p.studentId || '', ...dayCells, pr, ab, lt, ex, `${pct}%`];
    });
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `attendance-register-${regMonth}.csv`; a.click();
  };

  // ── Tab 2: Report ───────────────────────────────────────────────────────────
  const loadReport = useCallback(() => {
    const params = { startDate: rptStart, endDate: rptEnd, type };
    if (type === 'Student' && selectedBatch) params.batch = selectedBatch;
    dispatch(getAttendanceReport(params));
  }, [dispatch, rptStart, rptEnd, type, selectedBatch]);

  useEffect(() => { if (mainTab === 2) loadReport(); }, [mainTab, loadReport]);

  const exportReportCSV = () => {
    const header = ['Name', type === 'Student' ? 'Student ID' : 'Email', 'Total Days', 'Present', 'Absent', 'Late', 'Excused', 'Attendance %', 'Status'];
    const rows = report.map(r => [r.name, r.studentId || '', r.total, r.present, r.absent, r.late, r.excused,
      `${Number(r.percentage).toFixed(1)}%`, r.percentage >= 75 ? 'Regular' : r.percentage >= 50 ? 'Warning' : 'Irregular']);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `attendance-report-${rptStart}-${rptEnd}.csv`; a.click();
  };

  // ── Today's Stats ───────────────────────────────────────────────────────────
  const todayPresent  = attendanceLogs.filter(r => r.status === 'Present').length;
  const todayAbsent   = attendanceLogs.filter(r => r.status === 'Absent').length;
  const todayLate     = attendanceLogs.filter(r => r.status === 'Late').length;
  const todayTotal    = attendanceLogs.length;
  const todayPct      = todayTotal > 0 ? Math.round((todayPresent + todayLate) / todayTotal * 100) : 0;

  // ─────────────────────────────── UI ──────────────────────────────────────────
  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" fontWeight={800}>Attendance Management</Typography>
        <Typography variant="body2" color="text.secondary">Mark, view registers and generate reports for students & teachers</Typography>
      </Box>

      {/* Shared filter bar */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }} elevation={0} variant="outlined">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={type} label="Type" onChange={e => { setType(e.target.value); setSelectedBatch(''); }}>
                <MenuItem value="Student">Students</MenuItem>
                <MenuItem value="Teacher">Teachers</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {type === 'Student' && (
            <Grid item xs={12} sm={5}>
              <FormControl fullWidth size="small">
                <InputLabel>Batch</InputLabel>
                <Select value={selectedBatch} label="Batch" onChange={e => setSelectedBatch(e.target.value)}>
                  <MenuItem value="">— All Batches —</MenuItem>
                  {batches.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }} elevation={0} variant="outlined">
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}
          sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
          <Tab icon={<EventAvailableIcon />} iconPosition="start" label="Mark Attendance" />
          <Tab icon={<CalendarMonthIcon />} iconPosition="start" label="Monthly Register" />
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Attendance Report" />
        </Tabs>

        {/* ══════ TAB 0: MARK ATTENDANCE ══════ */}
        {mainTab === 0 && (
          <Box sx={{ p: 2.5 }}>
            {/* Date picker + stats */}
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Date" type="date" value={markDate}
                  onChange={e => setMarkDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              {todayTotal > 0 && (
                <>
                  {[
                    { label: 'Present', val: todayPresent, color: theme.palette.success.main },
                    { label: 'Absent',  val: todayAbsent,  color: theme.palette.error.main },
                    { label: 'Late',    val: todayLate,    color: theme.palette.warning.main },
                    { label: `${todayPct}%`, val: 'Att.', color: theme.palette.primary.main },
                  ].map((s, i) => (
                    <Grid item xs={6} sm={2} key={i}>
                      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(s.color, 0.08), border: `1px solid ${alpha(s.color, 0.2)}`, textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={900} sx={{ color: s.color }}>{s.label === 'Att.' ? s.val : s.val}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label === 'Att.' ? 'Attendance' : s.label}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </>
              )}
            </Grid>

            {loading && <LinearProgress sx={{ mb: 2 }} />}

            {markRows.length > 0 ? (
              <>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                  {['Present', 'Absent', 'Late', 'Excused'].map(s => (
                    <Button key={s} size="small" variant="outlined" color={STATUS_COLORS[s]}
                      onClick={() => handleMarkAll(s)}>
                      All {s}
                    </Button>
                  ))}
                  <Box sx={{ flex: 1 }} />
                  <Button variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                    onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Attendance'}
                  </Button>
                </Stack>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                        <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{type === 'Student' ? 'Student ID' : 'Email'}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Del</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {markRows.map((row, idx) => (
                        <TableRow key={idx} hover sx={{ bgcolor: row.status === 'Absent' ? alpha(theme.palette.error.main, 0.03) : 'inherit' }}>
                          <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{idx + 1}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: theme.palette.primary.main }}>
                                {row.name?.charAt(0)}
                              </Avatar>
                              <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{row.info}</TableCell>
                          <TableCell>
                            <RadioGroup row value={row.status} onChange={e => handleStatusChange(idx, e.target.value)}>
                              {Object.keys(STATUS_COLORS).map(s => (
                                <FormControlLabel key={s} value={s} label={s}
                                  control={<Radio size="small" color={STATUS_COLORS[s]} sx={{ p: 0.3 }} />}
                                  sx={{ mr: 1, '& .MuiFormControlLabel-label': { fontSize: 12 } }} />
                              ))}
                            </RadioGroup>
                          </TableCell>
                          <TableCell>
                            <TextField size="small" fullWidth placeholder="Optional…" value={row.remarks}
                              onChange={e => handleRemarksChange(idx, e.target.value)}
                              sx={{ '& input': { fontSize: 12, py: 0.5 } }} />
                          </TableCell>
                          <TableCell align="center">
                            {row.dbId && (
                              <Tooltip title="Delete record">
                                <IconButton size="small" color="error" onClick={() => handleDeleteRecord(row.dbId)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {type === 'Student' && !selectedBatch
                  ? 'Please select a batch to mark attendance.'
                  : `No ${type === 'Teacher' ? 'teachers' : 'students'} found.`}
              </Alert>
            )}
          </Box>
        )}

        {/* ══════ TAB 1: MONTHLY REGISTER ══════ */}
        {mainTab === 1 && (
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Month" type="month" value={regMonth}
                  onChange={e => setRegMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item>
                <Button variant="contained" size="small" onClick={loadRegister} disabled={loadingRegister}>
                  {loadingRegister ? <CircularProgress size={14} /> : 'Load Register'}
                </Button>
              </Grid>
              <Grid item>
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={exportRegisterCSV}
                  disabled={!monthlyRegister}>Export CSV</Button>
              </Grid>
            </Grid>

            {/* Legend */}
            <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap">
              {Object.keys(STATUS_SHORT).map(s => (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: 1, bgcolor: STATUS_BG[s], border: `1px solid ${STATUS_TXT[s]}` }} />
                  <Typography variant="caption" sx={{ color: STATUS_TXT[s], fontWeight: 700 }}>{STATUS_SHORT[s]} = {s}</Typography>
                </Box>
              ))}
            </Stack>

            {loadingRegister && <LinearProgress sx={{ mb: 2 }} />}

            {monthlyRegister && monthlyRegister.persons?.length > 0 ? (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 900, '& td,& th': { px: 0.5, py: 0.4, fontSize: 11, border: '1px solid', borderColor: 'divider' } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                      <TableCell sx={{ fontWeight: 700, minWidth: 140, position: 'sticky', left: 0, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>Name</TableCell>
                      {type === 'Student' && <TableCell sx={{ fontWeight: 700, minWidth: 60 }}>ID</TableCell>}
                      {monthlyRegister.days.map(d => (
                        <TableCell key={d} align="center" sx={{ fontWeight: 700, minWidth: 26 }}>{d}</TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 700, minWidth: 40, bgcolor: alpha(theme.palette.success.main, 0.08) }}>P</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, minWidth: 40, bgcolor: alpha(theme.palette.error.main, 0.08) }}>A</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, minWidth: 40, bgcolor: alpha(theme.palette.warning.main, 0.08) }}>L</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, minWidth: 50 }}>Att%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthlyRegister.persons.map((person) => {
                      const pr  = monthlyRegister.days.filter(d => person.days[d]?.status === 'Present').length;
                      const ab  = monthlyRegister.days.filter(d => person.days[d]?.status === 'Absent').length;
                      const lt  = monthlyRegister.days.filter(d => person.days[d]?.status === 'Late').length;
                      const tot = monthlyRegister.days.filter(d => person.days[d]).length;
                      const pct = tot > 0 ? ((pr + lt) / tot * 100).toFixed(0) : '—';
                      const pctNum = tot > 0 ? (pr + lt) / tot * 100 : 100;
                      return (
                        <TableRow key={person._id} hover>
                          <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper' }}>{person.name}</TableCell>
                          {type === 'Student' && <TableCell sx={{ color: 'text.secondary' }}>{person.studentId}</TableCell>}
                          {monthlyRegister.days.map(d => {
                            const cell = person.days[d];
                            return (
                              <TableCell key={d} align="center"
                                sx={{ bgcolor: cell ? STATUS_BG[cell.status] : 'transparent', color: cell ? STATUS_TXT[cell.status] : '#ccc', fontWeight: 700 }}>
                                <Tooltip title={cell ? `${cell.status}${cell.remarks ? ': ' + cell.remarks : ''}` : 'No record'}>
                                  <span>{cell ? STATUS_SHORT[cell.status] : '·'}</span>
                                </Tooltip>
                              </TableCell>
                            );
                          })}
                          <TableCell align="center" sx={{ color: theme.palette.success.main, fontWeight: 700 }}>{pr}</TableCell>
                          <TableCell align="center" sx={{ color: theme.palette.error.main, fontWeight: 700 }}>{ab}</TableCell>
                          <TableCell align="center" sx={{ color: theme.palette.warning.main, fontWeight: 700 }}>{lt}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800, color: pctNum >= 75 ? theme.palette.success.main : pctNum >= 50 ? theme.palette.warning.main : theme.palette.error.main }}>
                            {pct !== '—' ? `${pct}%` : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            ) : !loadingRegister && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {type === 'Student' && !selectedBatch ? 'Select a batch then click Load Register.' : 'No attendance data found for this month.'}
              </Alert>
            )}
          </Box>
        )}

        {/* ══════ TAB 2: ATTENDANCE REPORT ══════ */}
        {mainTab === 2 && (
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={2.5}>
                <TextField fullWidth size="small" label="From" type="date" value={rptStart}
                  onChange={e => setRptStart(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={2.5}>
                <TextField fullWidth size="small" label="To" type="date" value={rptEnd}
                  onChange={e => setRptEnd(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item>
                <Button variant="contained" size="small" onClick={loadReport} disabled={loadingReport}>
                  {loadingReport ? <CircularProgress size={14} /> : 'Generate Report'}
                </Button>
              </Grid>
              <Grid item>
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={exportReportCSV}
                  disabled={report.length === 0}>Export CSV</Button>
              </Grid>
            </Grid>

            {loadingReport && <LinearProgress sx={{ mb: 2 }} />}

            {report.length > 0 ? (
              <>
                {/* Summary cards */}
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {[
                    { label: 'Total',     val: report.length,                                                 color: theme.palette.primary.main },
                    { label: '≥75% (Regular)', val: report.filter(r => r.percentage >= 75).length,           color: theme.palette.success.main },
                    { label: '50-74% (Warning)', val: report.filter(r => r.percentage >= 50 && r.percentage < 75).length, color: theme.palette.warning.main },
                    { label: '<50% (Irregular)', val: report.filter(r => r.percentage < 50).length,           color: theme.palette.error.main },
                  ].map((s, i) => (
                    <Grid item xs={6} sm={3} key={i}>
                      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(s.color, 0.07), border: `1px solid ${alpha(s.color, 0.2)}`, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={900} sx={{ color: s.color }}>{s.val}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                        <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        {type === 'Student' && <TableCell sx={{ fontWeight: 700 }}>Student ID</TableCell>}
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Total</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: 'success.main' }}>Present</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: 'error.main' }}>Absent</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: 'warning.main' }}>Late</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: 'info.main' }}>Excused</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Attendance %</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...report].sort((a, b) => b.percentage - a.percentage).map((r, idx) => {
                        const pct = Number(r.percentage).toFixed(1);
                        const color = r.percentage >= 75 ? 'success' : r.percentage >= 50 ? 'warning' : 'error';
                        const label = r.percentage >= 75 ? 'Regular' : r.percentage >= 50 ? 'Warning' : 'Irregular';
                        return (
                          <TableRow key={r._id} hover sx={{ bgcolor: r.percentage < 50 ? alpha(theme.palette.error.main, 0.03) : 'inherit' }}>
                            <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{idx + 1}</TableCell>
                            <TableCell><Typography variant="body2" fontWeight={600}>{r.name}</Typography></TableCell>
                            {type === 'Student' && <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{r.studentId}</TableCell>}
                            <TableCell align="center">{r.total}</TableCell>
                            <TableCell align="center" sx={{ color: 'success.main', fontWeight: 700 }}>{r.present}</TableCell>
                            <TableCell align="center" sx={{ color: 'error.main', fontWeight: 700 }}>{r.absent}</TableCell>
                            <TableCell align="center" sx={{ color: 'warning.main', fontWeight: 700 }}>{r.late}</TableCell>
                            <TableCell align="center" sx={{ color: 'info.main' }}>{r.excused}</TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LinearProgress variant="determinate" value={Math.min(Number(pct), 100)} color={color}
                                  sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                                <Typography variant="body2" fontWeight={800} sx={{ color: `${color}.main`, minWidth: 42 }}>{pct}%</Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center"><Chip label={label} color={color} size="small" sx={{ fontWeight: 700 }} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : !loadingReport && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Set date range and click Generate Report.
              </Alert>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default Attendance;
