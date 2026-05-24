import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Tabs, Tab, Typography, Grid, Card, CardContent,
  Chip, alpha, CircularProgress
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import BadgeIcon from '@mui/icons-material/Badge';
import ListAltIcon from '@mui/icons-material/ListAlt';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  loadTodayScans, loadDailySummary, loadQRSettings,
  loadQRUsers, scanQR, clearLastScan,
} from '../../redux/qrAttendanceSlice';

import QRScanner       from './QRScanner';
import IDCardGenerator from './IDCardGenerator';
import AttendanceLogs  from './AttendanceLogs';
import QRSettings      from './QRSettings';

const QB_GREEN = '#2CA01C';

// ── Summary card ─────────────────────────────────────────────────────────────
const SummaryCard = ({ label, value, icon, color }) => (
  <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: alpha(color, 0.1),
                 display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#3D3D3D', lineHeight: 1 }}>
          {value ?? <CircularProgress size={20} />}
        </Typography>
        <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600 }}>{label}</Typography>
      </Box>
    </CardContent>
  </Card>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const QRAttendancePage = () => {
  const dispatch   = useDispatch();
  const { companyId } = useParams();
  const { todayScans, summary, settings, loadingScans } = useSelector(s => s.qrAttendance);
  const { selectedCompany } = useSelector(s => s.companies);

  const [tab, setTab] = useState(0);

  // Load everything once on mount
  useEffect(() => {
    dispatch(loadQRSettings(companyId));
    dispatch(loadTodayScans(companyId));
    dispatch(loadDailySummary({ companyId }));
  }, [dispatch, companyId]);

  // When ID Cards tab is selected, load the user list
  useEffect(() => {
    if (tab === 1) {
      dispatch(loadQRUsers({ companyId, userType: 'Student' }));
    }
  }, [tab, dispatch, companyId]);

  // ── handle scan from webcam ──────────────────────────────────────────────
  const handleScanResult = useCallback(async (rawQR) => {
    const result = await dispatch(scanQR({ rawQR, companyId }));
    const payload = result.payload;

    if (result.meta.requestStatus === 'fulfilled') {
      const type = payload?.type;
      if (type === 'checkin') {
        toast.success(`✅ ${payload.userName} — Check-In at ${new Date(payload.checkIn).toLocaleTimeString()}`);
        // Play beep if sound enabled
        if (settings?.soundEnabled) playBeep(440, 120);
      } else if (type === 'checkout') {
        toast.info(`🔵 ${payload.userName} — Check-Out (${payload.duration} min)`);
        if (settings?.soundEnabled) playBeep(660, 120);
      }
      // Refresh today's list + summary
      dispatch(loadTodayScans(companyId));
      dispatch(loadDailySummary({ companyId }));
    } else {
      const type = payload?.type;
      if (type === 'invalid')    toast.error(`❌ Invalid QR Code`);
      else if (type === 'already_in') toast.warning(`⚠️ ${payload.userName} already checked in today`);
      else if (type === 'completed')  toast.warning(`⚠️ ${payload.userName} already done for today`);
      else if (type === 'cooldown')   toast.warning(`⏳ ${payload.message}`);
      else                            toast.error(payload?.message || 'Scan failed');
      if (settings?.soundEnabled) playBeep(220, 200);
    }
    return payload;
  }, [dispatch, companyId, settings]);

  const playBeep = (freq, dur) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + dur / 1000);
    } catch (_) {}
  };

  // ── derived stats ────────────────────────────────────────────────────────
  const todayStudents  = summary?.students?.total  ?? 0;
  const todayTeachers  = summary?.teachers?.total  ?? 0;
  const todayCompleted = (summary?.students?.completed ?? 0) + (summary?.teachers?.completed ?? 0);
  const todayTotal     = summary?.total ?? 0;

  const TABS = [
    { label: 'Scanner',    icon: <QrCodeScannerIcon sx={{ fontSize: '1rem' }} /> },
    { label: 'ID Cards',   icon: <BadgeIcon         sx={{ fontSize: '1rem' }} /> },
    { label: "Today's Log",icon: <ListAltIcon        sx={{ fontSize: '1rem' }} /> },
    { label: 'History',    icon: <HistoryIcon        sx={{ fontSize: '1rem' }} /> },
    { label: 'Settings',   icon: <SettingsIcon       sx={{ fontSize: '1rem' }} /> },
  ];

  return (
    <Box sx={{ pb: 6 }}>
      {/* ── Page header ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 4, height: 40, borderRadius: 2, bgcolor: QB_GREEN, flexShrink: 0, mt: 0.25 }} />
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: '#3D3D3D', lineHeight: 1.2 }}>
            Smart QR Attendance
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mt: 0.3 }}>
            Webcam-based QR card scanning — {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Typography>
        </Box>
        {settings?.checkoutEnabled && (
          <Chip label="Check-In / Out Mode" size="small"
            sx={{ ml: 'auto', bgcolor: alpha('#0077C5', 0.1), color: '#0077C5', fontWeight: 700 }} />
        )}
      </Box>

      {/* ── Today's stats bar ─────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <SummaryCard label="Total Present" value={todayTotal} icon={<CheckCircleIcon />} color={QB_GREEN} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <SummaryCard label="Students" value={todayStudents} icon={<SchoolIcon />} color='#0077C5' />
        </Grid>
        <Grid item xs={6} sm={3}>
          <SummaryCard label="Teachers" value={todayTeachers} icon={<PeopleIcon />} color='#7C3AED' />
        </Grid>
        <Grid item xs={6} sm={3}>
          <SummaryCard label="Completed" value={todayCompleted} icon={<AccessTimeIcon />} color='#D97706' />
        </Grid>
      </Grid>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Box sx={{ borderBottom: '1px solid #E5E7EB', mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            '& .MuiTab-root': { minHeight: 44, fontWeight: 600, fontSize: '0.82rem', textTransform: 'none', gap: 0.5 },
            '& .Mui-selected': { color: `${QB_GREEN} !important` },
            '& .MuiTabs-indicator': { bgcolor: QB_GREEN, height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          {TABS.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>
      </Box>

      {/* ── Tab panels ────────────────────────────────────────────────── */}

      {/* Scanner */}
      {tab === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 600 }}>
            <QRScanner
              companyId={companyId}
              onScanResult={handleScanResult}
              settings={settings}
              autoStart={settings?.autoStart ?? false}
            />
          </Box>
        </Box>
      )}

      {/* ID Cards */}
      {tab === 1 && (
        <IDCardGenerator companyName={selectedCompany?.name} />
      )}

      {/* Today's log */}
      {tab === 2 && <AttendanceLogs view="today" />}

      {/* History */}
      {tab === 3 && <AttendanceLogs view="history" />}

      {/* Settings */}
      {tab === 4 && <QRSettings />}
    </Box>
  );
};

export default QRAttendancePage;
