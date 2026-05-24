import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField,
  InputAdornment, Chip, CircularProgress, alpha, ToggleButton,
  ToggleButtonGroup, Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import QrCodeIcon from '@mui/icons-material/QrCode';
import BadgeIcon from '@mui/icons-material/Badge';
import PrintIcon from '@mui/icons-material/Print';
import { useDispatch, useSelector } from 'react-redux';
import { generateQR, loadQRUsers } from '../../redux/qrAttendanceSlice';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const QB_GREEN = '#2CA01C';
const CARD_BG  = '#1C2B36';

// ── Single ID card (rendered to DOM for PDF capture) ────────────────────────
const IDCard = React.forwardRef(({ user, userType, companyName }, ref) => {
  const initials   = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const roleColor  = userType === 'Student' ? QB_GREEN : '#0077C5';
  const roleDark   = userType === 'Student' ? '#1A6010' : '#004F83';
  const infoText   = user.group?.name || user.specialization || '';
  const idText     = user.studentId || user.contact || '';

  return (
    <Box
      ref={ref}
      sx={{
        width: 340, height: 215,
        bgcolor: '#FFFFFF',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Inter","Roboto",sans-serif',
        boxShadow: '0 6px 32px rgba(0,0,0,0.15)',
        border: `1px solid #E5E7EB`,
        flexShrink: 0,
      }}
    >
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: roleColor, px: 1.5, py: 0.7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {companyName || 'The Learning Centre'}
        </Typography>
        <Box sx={{ px: 0.75, py: 0.2, borderRadius: 8, bgcolor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
          <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: '#fff', letterSpacing: '0.06em' }}>
            {userType.toUpperCase()}
          </Typography>
        </Box>
      </Box>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flex: 1, p: 1.25, gap: 1.25 }}>

        {/* Left: photo */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Box sx={{
            width: 72, height: 80, borderRadius: '6px',
            border: `2px solid ${roleColor}`,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(roleColor, 0.07),
            flexShrink: 0,
          }}>
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                crossOrigin="anonymous"
              />
            ) : (
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: roleColor, lineHeight: 1 }}>
                {initials}
              </Typography>
            )}
          </Box>
          {idText && (
            <Typography sx={{ fontSize: '0.52rem', color: '#9CA3AF', fontWeight: 700, textAlign: 'center', lineHeight: 1.2, maxWidth: 72 }} noWrap>
              {idText}
            </Typography>
          )}
        </Box>

        {/* Middle: name + info */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.4 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#111827', lineHeight: 1.15, wordBreak: 'break-word' }}>
            {user.name}
          </Typography>
          {infoText && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ width: 3, height: 10, borderRadius: 2, bgcolor: roleColor, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.65rem', color: roleColor, fontWeight: 700 }} noWrap>
                {infoText}
              </Typography>
            </Box>
          )}
          <Box sx={{ mt: 0.5, height: 1, bgcolor: '#F3F4F6' }} />
          <Typography sx={{ fontSize: '0.58rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Attendance ID Card
          </Typography>
        </Box>

        {/* Right: QR code */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.4, flexShrink: 0 }}>
          {user.qrDataUrl ? (
            <>
              <Box sx={{ p: 0.5, bgcolor: '#fff', borderRadius: '5px', border: `1.5px solid ${roleColor}`, lineHeight: 0 }}>
                <img src={user.qrDataUrl} alt="QR" width={76} height={76} style={{ display: 'block' }} />
              </Box>
              <Typography sx={{ fontSize: '0.5rem', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.04em' }}>
                SCAN TO MARK
              </Typography>
            </>
          ) : (
            <Box sx={{
              width: 76, height: 76, borderRadius: '5px',
              bgcolor: '#F9FAFB', border: '1.5px dashed #D1D5DB',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
            }}>
              <QrCodeIcon sx={{ fontSize: 28, color: '#D1D5DB' }} />
              <Typography sx={{ fontSize: '0.48rem', color: '#D1D5DB', textAlign: 'center', px: 0.5 }}>
                Generate QR
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: roleDark, px: 1.5, py: 0.45, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.06em' }}>
          Smart QR Attendance System · {companyName || 'The Learning Centre'}
        </Typography>
      </Box>
    </Box>
  );
});
IDCard.displayName = 'IDCard';

// ── Main component ───────────────────────────────────────────────────────────
const IDCardGenerator = ({ companyName }) => {
  const dispatch   = useDispatch();
  const { companyId } = useParams();
  const { users, loadingUsers } = useSelector(s => s.qrAttendance);

  const [userType,    setUserType]    = useState('Student');
  const [search,      setSearch]      = useState('');
  const [generating,  setGenerating]  = useState({});
  const [downloading, setDownloading] = useState({});
  const cardRefs = useRef({});

  // Reload whenever userType or companyId changes
  useEffect(() => {
    setSearch('');
    dispatch(loadQRUsers({ companyId, userType }));
  }, [userType, companyId, dispatch]);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.studentId?.toLowerCase().includes(search.toLowerCase()) ||
    u.contact?.toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerate = useCallback(async (user) => {
    setGenerating(g => ({ ...g, [user._id]: true }));
    await dispatch(generateQR({ userType, userId: user._id, companyId }));
    setGenerating(g => ({ ...g, [user._id]: false }));
  }, [dispatch, userType, companyId]);

  const handleDownload = useCallback(async (user) => {
    if (!user.qrDataUrl) return;
    setDownloading(d => ({ ...d, [user._id]: true }));
    try {
      const cardEl = cardRefs.current[user._id];
      if (!cardEl) return;
      const canvas = await html2canvas(cardEl, { scale: 3, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] });
      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
      pdf.save(`ID_Card_${user.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF gen error:', err);
    } finally {
      setDownloading(d => ({ ...d, [user._id]: false }));
    }
  }, []);

  const handlePrintAll = useCallback(async () => {
    const printable = filtered.filter(u => u.qrDataUrl);
    if (!printable.length) return;

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const cardsPerRow = 3;
    const cardW = 85.6, cardH = 54;
    const marginX = 5, marginY = 5, gapX = 5, gapY = 5;

    for (let i = 0; i < printable.length; i++) {
      const user = printable[i];
      const cardEl = cardRefs.current[user._id];
      if (!cardEl) continue;
      const canvas = await html2canvas(cardEl, { scale: 3, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const row = Math.floor(i / cardsPerRow);
      const col = i % cardsPerRow;
      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);
      if (i > 0 && col === 0 && row > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', x, y, cardW, cardH);
    }
    pdf.save('ID_Cards_All.pdf');
  }, [filtered]);

  return (
    <Box>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={userType}
          exclusive
          onChange={(_, v) => { if (v) setUserType(v); }}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 2, fontWeight: 700 } }}
        >
          <ToggleButton value="Student">Students</ToggleButton>
          <ToggleButton value="Teacher">Teachers</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="Search name / ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200, maxWidth: 340 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />

        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={handlePrintAll}
          sx={{ fontWeight: 700, borderColor: QB_GREEN, color: QB_GREEN, '&:hover': { bgcolor: alpha(QB_GREEN, 0.06), borderColor: QB_GREEN } }}
        >
          Print All with QR
        </Button>
      </Box>

      {/* ── Info banner ─────────────────────────────────────────────────── */}
      <Box sx={{ p: 1.5, mb: 2.5, borderRadius: 2, bgcolor: alpha(QB_GREEN, 0.06), border: `1px solid ${alpha(QB_GREEN, 0.2)}` }}>
        <Typography variant="body2" sx={{ color: '#3D3D3D' }}>
          <strong>{filtered.filter(u => u.hasQR).length}</strong> of <strong>{filtered.length}</strong> {userType.toLowerCase()}s have QR generated.
          Click <strong>Generate QR</strong> on any card, then <strong>Download</strong> or <strong>Print All</strong>.
        </Typography>
      </Box>

      {/* ── Cards grid ──────────────────────────────────────────────────── */}
      {loadingUsers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: QB_GREEN }} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filtered.map(user => (
            <Grid item xs={12} sm={6} md={4} key={user._id}>
              <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  {/* ID card preview */}
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                    <IDCard
                      ref={el => { cardRefs.current[user._id] = el; }}
                      user={user}
                      userType={userType}
                      companyName={companyName}
                    />
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!user.hasQR ? (
                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        startIcon={generating[user._id] ? <CircularProgress size={14} color="inherit" /> : <QrCodeIcon />}
                        onClick={() => handleGenerate(user)}
                        disabled={generating[user._id]}
                        sx={{ bgcolor: QB_GREEN, '&:hover': { bgcolor: '#238A15' }, fontWeight: 700, borderRadius: 1.5 }}
                      >
                        {generating[user._id] ? 'Generating…' : 'Generate QR'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={generating[user._id] ? <CircularProgress size={14} /> : <QrCodeIcon />}
                          onClick={() => handleGenerate(user)}
                          disabled={generating[user._id]}
                          sx={{ flex: 1, fontWeight: 600, borderRadius: 1.5, fontSize: '0.75rem' }}
                        >
                          Regenerate
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={downloading[user._id] ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
                          onClick={() => handleDownload(user)}
                          disabled={downloading[user._id]}
                          sx={{ flex: 1, bgcolor: QB_GREEN, '&:hover': { bgcolor: '#238A15' }, fontWeight: 700, borderRadius: 1.5, fontSize: '0.75rem' }}
                        >
                          {downloading[user._id] ? 'Saving…' : 'Download PDF'}
                        </Button>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {filtered.length === 0 && !loadingUsers && (
            <Grid item xs={12}>
              <Box sx={{ py: 8, textAlign: 'center', border: '1.5px dashed #D0D5DD', borderRadius: 3, bgcolor: '#FAFBFC' }}>
                <BadgeIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  No {userType.toLowerCase()}s found
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default IDCardGenerator;
