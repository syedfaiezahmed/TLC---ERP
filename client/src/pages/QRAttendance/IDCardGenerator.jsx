import React, { useState, useRef, useCallback } from 'react';
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
import { generateQR } from '../../redux/qrAttendanceSlice';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const QB_GREEN = '#2CA01C';
const CARD_BG  = '#1C2B36';

// ── Single ID card (rendered to DOM for PDF capture) ────────────────────────
const IDCard = React.forwardRef(({ user, userType, companyName }, ref) => {
  const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const roleColor = userType === 'Student' ? QB_GREEN : '#0077C5';

  return (
    <Box
      ref={ref}
      sx={{
        width: 320, height: 200,
        bgcolor: '#FFFFFF',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Inter", "Roboto", sans-serif',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        border: '1px solid #E5E7EB',
      }}
    >
      {/* Top accent bar */}
      <Box sx={{ height: 6, bgcolor: roleColor, flexShrink: 0 }} />

      {/* Body */}
      <Box sx={{ display: 'flex', flex: 1, p: 1.5, gap: 1.5 }}>
        {/* Left: photo + role chip */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          {/* Photo / placeholder */}
          <Box sx={{
            width: 64, height: 64, borderRadius: 2,
            bgcolor: alpha(roleColor, 0.1),
            border: `2px solid ${alpha(roleColor, 0.3)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: roleColor }}>
                {initials}
              </Typography>
            )}
          </Box>
          <Box sx={{
            px: 0.75, py: 0.25, borderRadius: 10,
            bgcolor: roleColor, display: 'inline-block',
          }}>
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {userType}
            </Typography>
          </Box>
        </Box>

        {/* Middle: info */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', lineHeight: 1.2, mb: 0.25 }} noWrap>
              {user.name}
            </Typography>
            {(user.group?.name || user.info || user.specialization) && (
              <Typography sx={{ fontSize: '0.65rem', color: '#6B7280', fontWeight: 500 }} noWrap>
                {user.group?.name || user.info || user.specialization}
              </Typography>
            )}
            {(user.studentId || user.contact) && (
              <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', mt: 0.25 }}>
                ID: {user.studentId || user.contact}
              </Typography>
            )}
          </Box>

          {/* Institute name */}
          <Box>
            <Box sx={{ height: 1, bgcolor: '#F3F4F6', mb: 0.5 }} />
            <Typography sx={{ fontSize: '0.6rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {companyName || 'The Learning Centre'}
            </Typography>
          </Box>
        </Box>

        {/* Right: QR code */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {user.qrDataUrl ? (
            <Box sx={{
              p: 0.5, bgcolor: '#fff', borderRadius: 1,
              border: '1px solid #E5E7EB',
            }}>
              <img src={user.qrDataUrl} alt="QR" width={68} height={68} style={{ display: 'block' }} />
            </Box>
          ) : (
            <Box sx={{
              width: 68, height: 68, borderRadius: 1,
              bgcolor: '#F9FAFB', border: '1px dashed #D1D5DB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <QrCodeIcon sx={{ fontSize: 28, color: '#D1D5DB' }} />
            </Box>
          )}
          <Typography sx={{ fontSize: '0.5rem', color: '#D1D5DB', mt: 0.25 }}>
            Scan to Mark
          </Typography>
        </Box>
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
    const printable = users.filter(u => u.qrDataUrl);
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
  }, [users]);

  return (
    <Box>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={userType}
          exclusive
          onChange={(_, v) => v && setUserType(v)}
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
