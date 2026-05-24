import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField,
  InputAdornment, Chip, CircularProgress, alpha, ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import SearchIcon    from '@mui/icons-material/Search';
import DownloadIcon  from '@mui/icons-material/Download';
import QrCodeIcon    from '@mui/icons-material/QrCode';
import BadgeIcon     from '@mui/icons-material/Badge';
import PrintIcon     from '@mui/icons-material/Print';
import { useDispatch, useSelector } from 'react-redux';
import { generateQR, loadQRUsers } from '../../redux/qrAttendanceSlice';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const QB_GREEN = '#2CA01C';

// ── Per-role colour palettes ──────────────────────────────────────────────────
const THEMES = {
  Student: {
    primary:   '#0057B7',
    dark:      '#003D82',
    accent:    '#F97316',
    accentBg:  '#FFF3E9',
    gradient:  'linear-gradient(135deg,#0057B7 0%,#003D82 100%)',
    footerBg:  '#002A5C',
  },
  Teacher: {
    primary:   '#F97316',
    dark:      '#C2580A',
    accent:    '#0057B7',
    accentBg:  '#E9F3FF',
    gradient:  'linear-gradient(135deg,#F97316 0%,#C2580A 100%)',
    footerBg:  '#8B3D04',
  },
};

// Card physical size in px (portrait CR80: 54mm × 85.6mm @ 96dpi)
const CW = 210; // ~54mm
const CH = 333; // ~85.6mm

const LOGO = '/logo.png';

// ── FRONT of ID card ─────────────────────────────────────────────────────────
const IDCardFront = React.forwardRef(({ user, userType, companyName }, ref) => {
  const t        = THEMES[userType] || THEMES.Student;
  const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const infoText = user.group?.name || user.specialization || '';
  const idText   = user.studentId   || user.contact        || '';
  const year     = new Date().getFullYear();

  return (
    <Box ref={ref} sx={{
      width: CW, height: CH,
      bgcolor: '#FFFFFF',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Inter","Roboto",sans-serif',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* ── Header (compact) ────────────────────────────────────────── */}
      <Box sx={{ background: t.gradient, px: 1.5, pt: 0.75, pb: 0.75, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.35 }}>
          <Box sx={{
            width: 22, height: 22, borderRadius: '5px',
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src={LOGO} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '0.02em' }}>
              {companyName || 'The Learning Centre'}
            </Typography>
            <Typography sx={{ fontSize: '0.44rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Smart Attendance System
            </Typography>
          </Box>
        </Box>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center',
          bgcolor: t.accent, borderRadius: '4px',
          px: 0.75, py: 0.15,
          boxShadow: `0 2px 6px ${alpha(t.accent, 0.5)}`,
        }}>
          <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {userType} ID Card
          </Typography>
        </Box>
      </Box>
      {/* Accent stripe */}
      <Box sx={{ height: 3, background: `linear-gradient(90deg,${t.accent} 0%,${alpha(t.accent,0.3)} 100%)`, flexShrink: 0 }} />

      {/* ── Photo + Info  (side-by-side — saves ~80px vs stacked) ───── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, mt: 1.25, mb: 0.75, flexShrink: 0 }}>
        {/* Photo with dual-colour ring */}
        <Box sx={{ p: '2.5px', borderRadius: '9px', background: `linear-gradient(135deg,${t.primary} 0%,${t.accent} 100%)`, flexShrink: 0 }}>
          <Box sx={{
            width: 58, height: 70,
            borderRadius: '7px', overflow: 'hidden',
            bgcolor: alpha(t.primary, 0.05),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                crossOrigin="anonymous" />
            ) : (
              <>
                <Box sx={{ position: 'absolute', width: 46, height: 46, borderRadius: '50%', bgcolor: alpha(t.primary, 0.07), top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: t.primary, lineHeight: 1, zIndex: 1 }}>
                  {initials}
                </Typography>
              </>
            )}
            <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16,
              background: t.accent, borderTopLeftRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#fff' }} />
            </Box>
          </Box>
        </Box>

        {/* Name + group + ID */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontSize: '0.85rem', fontWeight: 900, color: '#111827',
            lineHeight: 1.2, letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user.name}
          </Typography>
          {infoText && (
            <Box sx={{ mt: 0.4, display: 'inline-block', px: 0.7, py: 0.12, borderRadius: '20px', bgcolor: alpha(t.accent, 0.12), border: `1px solid ${alpha(t.accent, 0.4)}` }}>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: t.accent }}>
                {infoText}
              </Typography>
            </Box>
          )}
          {idText && (
            <Typography sx={{ fontSize: '0.56rem', color: '#9CA3AF', fontWeight: 600, mt: 0.3, letterSpacing: '0.03em' }}>
              ID: {idText}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, mb: 0.75, flexShrink: 0 }}>
        <Box sx={{ flex: 1, height: 1, bgcolor: '#F0F0F0' }} />
        <Box sx={{ mx: 0.5, width: 4, height: 4, borderRadius: '50%', bgcolor: t.accent }} />
        <Box sx={{ mx: 0.25, width: 3, height: 3, borderRadius: '50%', bgcolor: alpha(t.accent, 0.5) }} />
        <Box sx={{ mx: 0.5, width: 4, height: 4, borderRadius: '50%', bgcolor: t.accent }} />
        <Box sx={{ flex: 1, height: 1, bgcolor: '#F0F0F0' }} />
      </Box>

      {/* ── QR Code (96×96 — fully visible) ─────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 0.25, flexShrink: 0 }}>
        {user.qrDataUrl ? (
          <>
            <Box sx={{
              p: '5px', bgcolor: '#fff', borderRadius: '10px',
              border: `2.5px solid ${t.accent}`,
              boxShadow: `0 4px 16px ${alpha(t.accent, 0.3)}, 0 0 0 1px ${alpha(t.primary, 0.15)}`,
              lineHeight: 0,
            }}>
              <img src={user.qrDataUrl} alt="QR" width={100} height={100} style={{ display: 'block' }} />
            </Box>
            <Typography sx={{
              fontSize: '0.45rem', fontWeight: 800, mt: 0.5,
              color: t.accent, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              ▶ Scan to Mark Attendance ◀
            </Typography>
          </>
        ) : (
          <Box sx={{
            width: 100, height: 100, borderRadius: '10px',
            bgcolor: '#F9FAFB', border: `2px dashed ${alpha(t.primary, 0.3)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
          }}>
            <QrCodeIcon sx={{ fontSize: 32, color: alpha(t.primary, 0.3) }} />
            <Typography sx={{ fontSize: '0.44rem', color: alpha(t.primary, 0.4), fontWeight: 700 }}>
              QR Not Generated
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <Box sx={{
        mt: 'auto', bgcolor: t.footerBg, px: 1.5, py: 0.5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700, letterSpacing: '0.04em' }}>
          {userType.toUpperCase()}
        </Typography>
        <Box sx={{ width: 24, height: 1.5, borderRadius: 1, bgcolor: t.accent }} />
        <Typography sx={{ fontSize: '0.5rem', color: t.accent, fontWeight: 800 }}>
          {year}–{String(year + 1).slice(2)}
        </Typography>
      </Box>
    </Box>
  );
});
IDCardFront.displayName = 'IDCardFront';

// ── BACK of ID card ──────────────────────────────────────────────────────────
const IDCardBack = React.forwardRef(({ userType, companyName }, ref) => {
  const t = THEMES[userType] || THEMES.Student;

  const policies = [
    'This card must be carried at all times within the institute premises.',
    'Scan your card at entry to mark attendance — no manual entry is accepted.',
    'This card is strictly non-transferable and non-shareable.',
    'Report a lost or damaged card to the admin office immediately.',
    'Misuse of this card may result in disciplinary action.',
    'Replacement charge may apply for lost cards.',
  ];

  return (
    <Box ref={ref} sx={{
      width: CW, height: CH,
      bgcolor: '#FFFFFF',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Inter","Roboto",sans-serif',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      flexShrink: 0,
    }}>
      {/* ── Back header (smaller) ────────────────────────────────────── */}
      <Box sx={{ background: t.gradient, px: 1.5, py: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{
            width: 22, height: 22, borderRadius: '5px',
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src={LOGO} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
          </Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 900, color: '#fff', letterSpacing: '0.02em' }}>
            {companyName || 'The Learning Centre'}
          </Typography>
        </Box>
      </Box>

      {/* ── Accent stripe — thicker so it’s clearly visible ───────── */}
      <Box sx={{ height: 4, background: `linear-gradient(90deg,${t.accent} 0%,${t.primary} 60%,${t.accent} 100%)`, flexShrink: 0 }} />

      {/* ── Policies ─────────────────────────────────────────────────── */}
      <Box sx={{ px: 1.5, pt: 1.25, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Section title — primary bar + accent pill */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1 }}>
          <Box sx={{ width: 3, height: 14, borderRadius: 2, bgcolor: t.accent }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: t.primary, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
            Card Policies & Guidelines
          </Typography>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: alpha(t.accent, 0.25), border: `1.5px solid ${t.accent}` }} />
        </Box>

        {policies.map((p, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 0.6, mb: 0.6 }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: t.accent, mt: '3px', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.54rem', color: '#374151', lineHeight: 1.45, fontWeight: 500 }}>
              {p}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Return info — accent-bordered box ──────────────────────── */}
      <Box sx={{
        mx: 1.5, mb: 1.25, borderRadius: '8px',
        bgcolor: alpha(t.accent, 0.04),
        border: `1.5px solid ${alpha(t.accent, 0.35)}`,
        p: 1, flexShrink: 0,
        borderLeft: `3px solid ${t.accent}`,
      }}>
        <Typography sx={{ fontSize: '0.52rem', fontWeight: 800, color: t.accent, mb: 0.4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          If Found, Please Return To:
        </Typography>
        <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#111827' }}>
          {companyName || 'The Learning Centre'}
        </Typography>
        <Typography sx={{ fontSize: '0.52rem', color: '#6B7280', mt: 0.15 }}>
          Admin Office · Smart QR Attendance System
        </Typography>
      </Box>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: t.footerBg, px: 1.5, py: 0.55,
        display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Authorised Attendance Card · Not For Resale
        </Typography>
      </Box>
    </Box>
  );
});
IDCardBack.displayName = 'IDCardBack';

// ── Main component ───────────────────────────────────────────────────────────
// Portrait CR80: 54mm × 85.6mm
const PDF_W = 54, PDF_H = 85.6;

const IDCardGenerator = ({ companyName }) => {
  const dispatch   = useDispatch();
  const { companyId } = useParams();
  const { users, loadingUsers } = useSelector(s => s.qrAttendance);

  const [userType,    setUserType]    = useState('Student');
  const [search,      setSearch]      = useState('');
  const [generating,  setGenerating]  = useState({});
  const [downloading, setDownloading] = useState({});

  const frontRefs = useRef({});
  const backRefs  = useRef({});

  const t = THEMES[userType] || THEMES.Student;

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

  // Download = 2-page PDF: page 1 = front, page 2 = back
  const handleDownload = useCallback(async (user) => {
    if (!user.qrDataUrl) return;
    setDownloading(d => ({ ...d, [user._id]: true }));
    try {
      const frontEl = frontRefs.current[user._id];
      const backEl  = backRefs.current[user._id];
      if (!frontEl) return;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PDF_W, PDF_H] });

      // Page 1: Front
      const frontCanvas = await html2canvas(frontEl, { scale: 4, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, PDF_W, PDF_H);

      // Page 2: Back
      if (backEl) {
        const backCanvas = await html2canvas(backEl, { scale: 4, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        pdf.addPage();
        pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, PDF_W, PDF_H);
      }

      pdf.save(`ID_Card_${user.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF gen error:', err);
    } finally {
      setDownloading(d => ({ ...d, [user._id]: false }));
    }
  }, []);

  // Print All: fronts on first set of A4 pages, backs on next set
  const handlePrintAll = useCallback(async () => {
    const printable = filtered.filter(u => u.qrDataUrl);
    if (!printable.length) return;

    // Portrait A4: 210 × 297 mm, 3 cards per row, 3 per col = 9 per page
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cpr = 3, cpc = 3, perPage = cpr * cpc;
    const marginX = 6, marginY = 6, gapX = 4, gapY = 4;
    const cardW = (210 - marginX * 2 - gapX * (cpr - 1)) / cpr;  // ~62mm
    const cardH = cardW * (PDF_H / PDF_W);                         // maintain ratio

    let isFirst = true;

    // ── All fronts ──
    for (let i = 0; i < printable.length; i++) {
      const user  = printable[i];
      const el    = frontRefs.current[user._id];
      if (!el) continue;
      const row = Math.floor((i % perPage) / cpr);
      const col = i % cpr;
      if (i > 0 && i % perPage === 0) pdf.addPage();
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);
      if (isFirst) isFirst = false;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, cardW, cardH);
    }

    // ── All backs (new page section) ──
    pdf.addPage();
    for (let i = 0; i < printable.length; i++) {
      const user = printable[i];
      const el   = backRefs.current[user._id];
      if (!el) continue;
      const row = Math.floor((i % perPage) / cpr);
      const col = i % cpr;
      if (i > 0 && i % perPage === 0) pdf.addPage();
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, cardW, cardH);
    }

    pdf.save(`ID_Cards_All_${userType}.pdf`);
  }, [filtered, userType]);

  const SCALE = 0.52;

  return (
    <Box sx={{ position: 'relative' }}>

      {/* ── Off-screen full-size cards for html2canvas capture ─────────── */}
      {/* IMPORTANT: these must NOT be visibility:hidden or display:none */}
      {/* position: absolute + left:-9999 keeps them rendered but invisible */}
      <Box sx={{ position: 'absolute', left: -9999, top: 0, width: CW, zIndex: -1, pointerEvents: 'none' }}>
        {filtered.map(user => (
          <Box key={`hidden-${user._id}`} sx={{ mb: 2 }}>
            <IDCardFront
              ref={el => { frontRefs.current[user._id] = el; }}
              user={user}
              userType={userType}
              companyName={companyName}
            />
            <Box sx={{ height: 8 }} />
            <IDCardBack
              ref={el => { backRefs.current[user._id] = el; }}
              userType={userType}
              companyName={companyName}
            />
          </Box>
        ))}
      </Box>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={userType}
          exclusive
          onChange={(_, v) => { if (v) setUserType(v); }}
          size="small"
          sx={{
            '& .MuiToggleButton-root': { px: 2.5, fontWeight: 700 },
            '& .Mui-selected': { bgcolor: `${t.primary} !important`, color: '#fff !important' },
          }}
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
          sx={{ fontWeight: 700, borderColor: t.primary, color: t.primary, '&:hover': { bgcolor: alpha(t.primary, 0.06), borderColor: t.primary } }}
        >
          Print All (Front + Back)
        </Button>
      </Box>

      {/* ── Info banner ─────────────────────────────────────────────────── */}
      <Box sx={{ p: 1.5, mb: 2.5, borderRadius: 2, bgcolor: alpha(t.primary, 0.05), border: `1px solid ${alpha(t.primary, 0.18)}` }}>
        <Typography variant="body2" sx={{ color: '#3D3D3D' }}>
          <strong>{filtered.filter(u => u.hasQR).length}</strong> / <strong>{filtered.length}</strong> {userType.toLowerCase()}s have QR generated.
          Download = 2-page PDF (Front + Back). Print All = full A4 sheet.
        </Typography>
      </Box>

      {/* ── Cards grid ──────────────────────────────────────────────────── */}
      {loadingUsers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: t.primary }} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filtered.map(user => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={user._id}>
              <Card sx={{ border: `1px solid ${alpha(t.primary, 0.15)}`, boxShadow: 'none', borderRadius: 3 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>

                  {/* Front + Back display preview — NO refs here, proper clip */}
                  <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'center', gap: 1 }}>
                    {/* Front display */}
                    <Box sx={{ width: CW * SCALE, height: CH * SCALE, overflow: 'hidden', position: 'relative', flexShrink: 0, borderRadius: '7px' }}>
                      <Box sx={{ position: 'absolute', top: 0, left: 0, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
                        <IDCardFront user={user} userType={userType} companyName={companyName} />
                      </Box>
                    </Box>
                    {/* Back display */}
                    <Box sx={{ width: CW * SCALE, height: CH * SCALE, overflow: 'hidden', position: 'relative', flexShrink: 0, borderRadius: '7px' }}>
                      <Box sx={{ position: 'absolute', top: 0, left: 0, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
                        <IDCardBack userType={userType} companyName={companyName} />
                      </Box>
                    </Box>
                  </Box>

                  {/* Labels */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600 }}>FRONT</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 600 }}>BACK</Typography>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!user.hasQR ? (
                      <Button fullWidth variant="contained" size="small"
                        startIcon={generating[user._id] ? <CircularProgress size={14} color="inherit" /> : <QrCodeIcon />}
                        onClick={() => handleGenerate(user)}
                        disabled={generating[user._id]}
                        sx={{ bgcolor: t.primary, '&:hover': { bgcolor: t.dark }, fontWeight: 700, borderRadius: 1.5 }}
                      >
                        {generating[user._id] ? 'Generating…' : 'Generate QR'}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outlined" size="small"
                          startIcon={generating[user._id] ? <CircularProgress size={13} /> : <QrCodeIcon />}
                          onClick={() => handleGenerate(user)}
                          disabled={generating[user._id]}
                          sx={{ flex: 1, fontWeight: 600, borderRadius: 1.5, fontSize: '0.72rem', borderColor: t.primary, color: t.primary }}
                        >
                          Refresh QR
                        </Button>
                        <Button variant="contained" size="small"
                          startIcon={downloading[user._id] ? <CircularProgress size={13} color="inherit" /> : <DownloadIcon />}
                          onClick={() => handleDownload(user)}
                          disabled={downloading[user._id]}
                          sx={{ flex: 1, bgcolor: t.primary, '&:hover': { bgcolor: t.dark }, fontWeight: 700, borderRadius: 1.5, fontSize: '0.72rem' }}
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
              <Box sx={{ py: 8, textAlign: 'center', border: `1.5px dashed ${alpha(t.primary, 0.2)}`, borderRadius: 3, bgcolor: alpha(t.primary, 0.02) }}>
                <BadgeIcon sx={{ fontSize: 48, color: alpha(t.primary, 0.25), mb: 1 }} />
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
