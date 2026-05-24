import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, TextField,
  InputAdornment, ToggleButtonGroup, ToggleButton, CircularProgress,
  Tooltip, Pagination, alpha
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import { useDispatch, useSelector } from 'react-redux';
import { loadTodayScans, loadScanHistory, removeQRScan } from '../../redux/qrAttendanceSlice';
import { useParams } from 'react-router-dom';

const QB_GREEN = '#2CA01C';

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });

const StatusBadge = ({ status }) =>
  status === 'completed' ? (
    <Chip icon={<CheckCircleIcon sx={{ fontSize: '0.8rem !important' }} />}
      label="Completed" size="small"
      sx={{ bgcolor: alpha(QB_GREEN, 0.1), color: QB_GREEN, fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
  ) : (
    <Chip icon={<RadioButtonCheckedIcon sx={{ fontSize: '0.8rem !important' }} />}
      label="Present" size="small"
      sx={{ bgcolor: alpha('#0077C5', 0.1), color: '#0077C5', fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
  );

const AttendanceLogs = ({ view = 'today' }) => {
  const dispatch = useDispatch();
  const { companyId } = useParams();
  const { todayScans, history, historyTotal, loadingScans, loadingHistory } = useSelector(s => s.qrAttendance);

  const [userType, setUserType] = useState('');
  const [search,   setSearch]   = useState('');
  const [date,     setDate]     = useState('');
  const [page,     setPage]     = useState(1);
  const LIMIT = 25;

  const loadToday = useCallback(() => dispatch(loadTodayScans(companyId)), [dispatch, companyId]);

  const loadHistory = useCallback(() => {
    dispatch(loadScanHistory({
      companyId,
      page,
      limit: LIMIT,
      ...(userType && { userType }),
      ...(search   && { search }),
      ...(date     && { date }),
    }));
  }, [dispatch, companyId, page, userType, search, date]);

  useEffect(() => {
    if (view === 'today') loadToday();
    else loadHistory();
  }, [view, page, userType, date]);  // search is triggered by explicit search

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this attendance record?')) return;
    dispatch(removeQRScan(id));
  };

  const rows    = view === 'today' ? todayScans : history;
  const loading = view === 'today' ? loadingScans : loadingHistory;

  const filtered = view === 'today'
    ? rows.filter(r =>
        (!userType || r.userType === userType) &&
        (!search   || r.userName?.toLowerCase().includes(search.toLowerCase()))
      )
    : rows;

  return (
    <Box>
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={userType}
          exclusive
          onChange={(_, v) => setUserType(v || '')}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 2, fontWeight: 600 } }}
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="Student">Students</ToggleButton>
          <ToggleButton value="Teacher">Teachers</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="Search name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (view === 'history' ? loadHistory() : null)}
          sx={{ flex: 1, minWidth: 180, maxWidth: 260 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          }}
        />

        {view === 'history' && (
          <TextField
            size="small"
            type="date"
            label="Date"
            value={date}
            onChange={e => { setDate(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 170 }}
          />
        )}

        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={view === 'today' ? loadToday : loadHistory}
            sx={{ bgcolor: alpha(QB_GREEN, 0.08), color: QB_GREEN, '&:hover': { bgcolor: alpha(QB_GREEN, 0.15) } }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Count summary */}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>
          {['Student', 'Teacher'].map(t => {
            const cnt = filtered.filter(r => r.userType === t).length;
            return cnt > 0 ? (
              <Chip key={t} label={`${cnt} ${t}${cnt > 1 ? 's' : ''}`} size="small"
                sx={{ fontWeight: 700, bgcolor: alpha(QB_GREEN, 0.08), color: QB_GREEN }} />
            ) : null;
          })}
        </Box>
      </Box>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <TableContainer component={Paper} elevation={0}
        sx={{ border: '1px solid #E5E7EB', borderRadius: 2, maxHeight: 520, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: '#F9FAFB', fontWeight: 700, fontSize: '0.78rem', color: '#6B7280', borderBottom: '1px solid #E5E7EB' } }}>
              <TableCell>#</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              {view === 'history' && <TableCell>Date</TableCell>}
              <TableCell>Info</TableCell>
              <TableCell>Check-In</TableCell>
              <TableCell>Check-Out</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} sx={{ color: QB_GREEN }} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6, color: '#9CA3AF' }}>
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, i) => (
                <TableRow key={row._id} hover sx={{ '&:hover': { bgcolor: alpha(QB_GREEN, 0.03) } }}>
                  <TableCell sx={{ color: '#9CA3AF', fontSize: '0.75rem' }}>
                    {(page - 1) * LIMIT + i + 1}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{row.userName}</TableCell>
                  <TableCell>
                    <Chip label={row.userType} size="small"
                      sx={{
                        bgcolor: row.userType === 'Student' ? alpha(QB_GREEN, 0.1) : alpha('#0077C5', 0.1),
                        color:   row.userType === 'Student' ? QB_GREEN : '#0077C5',
                        fontWeight: 700, fontSize: '0.68rem', height: 20,
                      }} />
                  </TableCell>
                  {view === 'history' && (
                    <TableCell sx={{ fontSize: '0.78rem' }}>{fmtDate(row.date)}</TableCell>
                  )}
                  <TableCell sx={{ fontSize: '0.75rem', color: '#6B7280', maxWidth: 120 }}
                    title={row.userInfo}>{row.userInfo || '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: QB_GREEN }}>
                    {fmtTime(row.checkIn)}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: '#0077C5' }}>
                    {fmtTime(row.checkOut)}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    {row.duration > 0 ? `${row.duration} min` : '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell align="center">
                    <Tooltip title="Delete record">
                      <IconButton size="small" onClick={() => handleDelete(row._id)}
                        sx={{ color: '#D92D20', '&:hover': { bgcolor: alpha('#D92D20', 0.08) } }}>
                        <DeleteIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Pagination (history only) ────────────────────────────────────── */}
      {view === 'history' && historyTotal > LIMIT && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={Math.ceil(historyTotal / LIMIT)}
            page={page}
            onChange={(_, v) => setPage(v)}
            sx={{ '& .MuiPaginationItem-root.Mui-selected': { bgcolor: QB_GREEN, color: '#fff' } }}
          />
        </Box>
      )}
    </Box>
  );
};

export default AttendanceLogs;
