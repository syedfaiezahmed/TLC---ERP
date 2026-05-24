import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, CardActions, Checkbox,
  FormControlLabel, Button, Chip, Divider, CircularProgress, Alert,
  alpha, Grid, Tooltip, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RefreshIcon            from '@mui/icons-material/Refresh';
import SaveIcon               from '@mui/icons-material/Save';
import PersonIcon             from '@mui/icons-material/Person';
import SchoolIcon             from '@mui/icons-material/School';
import { useDispatch, useSelector } from 'react-redux';
import { useParams }               from 'react-router-dom';
import { toast }                   from 'react-toastify';
import { loadTodayScans }          from '../../redux/qrAttendanceSlice';
import { fetchClassLogs, saveClassLogs as saveClassLogsAPI } from '../../services/api';

const QB_GREEN = '#2CA01C';
const fmtTime  = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Build key for a batch+subject selection ───────────────────────────────────
const makeKey = (batchId, subject = '') => `${batchId}::${subject}`;
const parseKey = (key) => { const [batchId, subject] = key.split('::'); return { batchId, subject: subject || '' }; };

// ── Status chip ───────────────────────────────────────────────────────────────
const StatusChip = ({ status, color }) => (
  <Chip
    icon={status === 'completed'
      ? <CheckCircleIcon sx={{ fontSize: '0.8rem !important' }} />
      : <RadioButtonCheckedIcon sx={{ fontSize: '0.8rem !important' }} />}
    label={status === 'completed' ? 'Done' : 'Present'}
    size="small"
    sx={{ bgcolor: alpha(color, 0.1), color, fontWeight: 700, fontSize: '0.68rem', height: 20 }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
const TodayRegister = () => {
  const dispatch   = useDispatch();
  const { companyId } = useParams();
  const { todayScans, loadingScans } = useSelector(s => s.qrAttendance);

  const [classLogs,   setClassLogs]   = useState([]);   // per-class teacher rows from API
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving,      setSaving]      = useState({});   // teacherId → bool
  const [selections,  setSelections]  = useState({});   // teacherId → Set<key>

  // ── Load per-class teacher logs ─────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data } = await fetchClassLogs(companyId, todayISO());
      setClassLogs(data);

      // Pre-fill selections from already-saved logs
      const sel = {};
      data.forEach(row => {
        const tId = row.teacher._id;
        sel[tId] = new Set();
        row.batches.forEach(b => {
          if (b.loggedSubjects && b.loggedSubjects.length > 0) {
            b.loggedSubjects.forEach(s => sel[tId].add(makeKey(b._id, s)));
          } else if (b.logged) {
            sel[tId].add(makeKey(b._id, ''));
          }
        });
      });
      setSelections(sel);
    } catch (e) {
      console.error('loadLogs error:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, [companyId]);

  useEffect(() => {
    dispatch(loadTodayScans(companyId));
    loadLogs();
  }, [companyId]); // eslint-disable-line

  const refresh = () => {
    dispatch(loadTodayScans(companyId));
    loadLogs();
  };

  // ── Toggle a batch/subject checkbox ────────────────────────────────────────
  const toggleKey = (teacherId, key) => {
    setSelections(prev => {
      const set = new Set(prev[teacherId] || []);
      if (set.has(key)) set.delete(key); else set.add(key);
      return { ...prev, [teacherId]: set };
    });
  };

  // ── Save class logs for one teacher ────────────────────────────────────────
  const handleSave = async (teacherId) => {
    setSaving(p => ({ ...p, [teacherId]: true }));
    try {
      const sel      = selections[teacherId] || new Set();
      const sessions = [...sel].map(parseKey);
      await saveClassLogsAPI({ companyId, teacherId, date: todayISO(), sessions });
      toast.success('Class log saved!');
      loadLogs();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save class log');
    } finally {
      setSaving(p => ({ ...p, [teacherId]: false }));
    }
  };

  // ── Derived lists ───────────────────────────────────────────────────────────
  const teacherScans  = todayScans.filter(r => r.userType === 'Teacher');
  const studentScans  = todayScans.filter(r => r.userType === 'Student');

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ color: '#1F2937', lineHeight: 1 }}>
            Today's Attendance Register
          </Typography>
          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
            {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={refresh}
            sx={{ bgcolor: alpha(QB_GREEN, 0.08), color: QB_GREEN, '&:hover': { bgcolor: alpha(QB_GREEN, 0.16) } }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — Per-Class Teacher Class Log Management
      ══════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ mb: 4 }}>
        {/* Section title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ width: 4, height: 22, borderRadius: 2, bgcolor: '#7C3AED', flexShrink: 0 }} />
          <Typography fontWeight={800} sx={{ color: '#374151' }}>
            Mark Classes Taken Today&nbsp;
            <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#9CA3AF' }}>
              (per-class / hybrid teachers only)
            </Typography>
          </Typography>
          {loadingLogs && <CircularProgress size={16} sx={{ color: '#7C3AED', ml: 1 }} />}
        </Box>

        {!loadingLogs && classLogs.length === 0 && (
          <Alert severity="info" sx={{ borderRadius: 2, fontSize: '0.82rem' }}>
            No per-class teachers are marked present today yet. Teachers must <strong>scan their QR card first</strong>, then their class log card will appear here.
          </Alert>
        )}

        <Grid container spacing={2}>
          {classLogs.map(row => {
            const tId = row.teacher._id;
            const sel = selections[tId] || new Set();
            const selCount = sel.size;

            return (
              <Grid item xs={12} sm={6} lg={4} key={tId}>
                <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1, pb: 0 }}>
                    {/* Teacher header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          width: 36, height: 36, borderRadius: '50%',
                          bgcolor: alpha('#7C3AED', 0.1),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <PersonIcon sx={{ fontSize: '1.1rem', color: '#7C3AED' }} />
                        </Box>
                        <Box>
                          <Typography fontWeight={700} sx={{ fontSize: '0.88rem', color: '#1F2937', lineHeight: 1.2 }}>
                            {row.teacher.name}
                          </Typography>
                          <Chip
                            label={row.teacher.salaryType === 'hybrid' ? 'Hybrid' : 'Per-Class'}
                            size="small"
                            sx={{ bgcolor: alpha('#7C3AED', 0.1), color: '#7C3AED', fontWeight: 700, fontSize: '0.65rem', height: 18, mt: 0.25 }}
                          />
                        </Box>
                      </Box>
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '0.8rem !important' }} />}
                        label={`${selCount} class${selCount !== 1 ? 'es' : ''}`}
                        size="small"
                        sx={{ bgcolor: alpha(QB_GREEN, 0.1), color: QB_GREEN, fontWeight: 700, fontSize: '0.7rem' }}
                      />
                    </Box>

                    <Divider sx={{ mb: 1.5 }} />

                    {/* Batch/subject checkboxes */}
                    {row.batches.length === 0 ? (
                      <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                        No active batches assigned.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        {row.batches.map(b => {
                          const hasSubjects = b.subjects && b.subjects.length > 0;

                          if (hasSubjects) {
                            return (
                              <Box key={b._id} sx={{ mb: 0.5 }}>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#6B7280', mb: 0.25, pl: 0.5 }}>
                                  {b.name} — {b.course?.name}
                                </Typography>
                                {b.subjects.map(subj => {
                                  const key = makeKey(b._id, subj);
                                  return (
                                    <FormControlLabel key={subj}
                                      control={
                                        <Checkbox size="small" checked={sel.has(key)}
                                          onChange={() => toggleKey(tId, key)}
                                          sx={{ color: '#D1D5DB', '&.Mui-checked': { color: QB_GREEN }, py: 0.25 }} />
                                      }
                                      label={<Typography sx={{ fontSize: '0.78rem' }}>{subj}</Typography>}
                                      sx={{ ml: 0.5, mr: 0 }}
                                    />
                                  );
                                })}
                              </Box>
                            );
                          }

                          const key = makeKey(b._id, '');
                          return (
                            <FormControlLabel key={b._id}
                              control={
                                <Checkbox size="small" checked={sel.has(key)}
                                  onChange={() => toggleKey(tId, key)}
                                  sx={{ color: '#D1D5DB', '&.Mui-checked': { color: QB_GREEN }, py: 0.4 }} />
                              }
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{b.name}</Typography>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                                    {b.course?.name} · ₹{b.ratePerClass}/class
                                  </Typography>
                                </Box>
                              }
                              sx={{ ml: 0, mr: 0 }}
                            />
                          );
                        })}
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 1.5, pt: 1 }}>
                    <Button fullWidth size="small" variant="contained"
                      onClick={() => handleSave(tId)}
                      disabled={saving[tId]}
                      startIcon={saving[tId]
                        ? <CircularProgress size={14} color="inherit" />
                        : <SaveIcon sx={{ fontSize: '0.9rem' }} />}
                      sx={{
                        bgcolor: QB_GREEN, '&:hover': { bgcolor: '#238A15' },
                        textTransform: 'none', fontWeight: 700, borderRadius: 1.5, boxShadow: 'none',
                      }}
                    >
                      {saving[tId] ? 'Saving…' : 'Save Class Log'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — Today's QR Scan List
      ══════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 4, height: 22, borderRadius: 2, bgcolor: QB_GREEN, flexShrink: 0 }} />
        <Typography fontWeight={800} sx={{ color: '#374151' }}>
          QR Scan Log&nbsp;
          <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#9CA3AF' }}>
            ({todayScans.length} scan{todayScans.length !== 1 ? 's' : ''} today)
          </Typography>
        </Typography>
      </Box>

      {loadingScans && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: QB_GREEN }} />
        </Box>
      )}

      {!loadingScans && todayScans.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>No QR scans recorded today yet.</Alert>
      )}

      {!loadingScans && todayScans.length > 0 && (
        <Grid container spacing={2}>
          {/* Teachers */}
          {teacherScans.length > 0 && (
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <PersonIcon sx={{ fontSize: '0.9rem', color: '#7C3AED' }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Teachers ({teacherScans.length})
                </Typography>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#F9FAFB', fontWeight: 700, fontSize: '0.72rem', color: '#6B7280' } }}>
                      <TableCell>Name</TableCell>
                      <TableCell>In</TableCell>
                      <TableCell>Out</TableCell>
                      <TableCell>Dur.</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teacherScans.map(r => (
                      <TableRow key={r._id} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{r.userName}</TableCell>
                        <TableCell sx={{ fontSize: '0.78rem', color: QB_GREEN, fontWeight: 600 }}>{fmtTime(r.checkIn)}</TableCell>
                        <TableCell sx={{ fontSize: '0.78rem', color: '#0077C5' }}>{fmtTime(r.checkOut)}</TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                          {r.duration > 0 ? `${r.duration}m` : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={r.status} color={r.status === 'completed' ? QB_GREEN : '#7C3AED'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          )}

          {/* Students */}
          {studentScans.length > 0 && (
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <SchoolIcon sx={{ fontSize: '0.9rem', color: QB_GREEN }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: QB_GREEN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Students ({studentScans.length})
                </Typography>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#F9FAFB', fontWeight: 700, fontSize: '0.72rem', color: '#6B7280' } }}>
                      <TableCell>Name</TableCell>
                      <TableCell>Group</TableCell>
                      <TableCell>In</TableCell>
                      <TableCell>Out</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {studentScans.map(r => (
                      <TableRow key={r._id} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{r.userName}</TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{r.userInfo || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.78rem', color: QB_GREEN, fontWeight: 600 }}>{fmtTime(r.checkIn)}</TableCell>
                        <TableCell sx={{ fontSize: '0.78rem', color: '#0077C5' }}>{fmtTime(r.checkOut)}</TableCell>
                        <TableCell>
                          <StatusChip status={r.status} color={r.status === 'completed' ? QB_GREEN : '#0077C5'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default TodayRegister;
