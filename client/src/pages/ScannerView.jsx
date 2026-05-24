import React, { useRef, useState, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { Box, Typography, Fade, CircularProgress, Chip, alpha } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useSelector, useDispatch } from 'react-redux';
import { processQRScan, fetchQRSettings } from '../services/api';
import { logout } from '../redux/authSlice';

const QB_GREEN   = '#2CA01C';
const DARK_BG    = '#0D1117';
const CARD_DARK  = '#161B22';
const BORDER     = '#30363D';

// ── Feedback overlay types ────────────────────────────────────────────────────
const FEEDBACK = {
  checkin:    { bg: '#0D2B17', border: QB_GREEN,  icon: <CheckCircleIcon  sx={{ fontSize: 56, color: QB_GREEN  }} />, color: QB_GREEN,  action: 'CHECK-IN' },
  checkout:   { bg: '#0D1E2B', border: '#0077C5', icon: <CheckCircleIcon  sx={{ fontSize: 56, color: '#0077C5' }} />, color: '#0077C5', action: 'CHECK-OUT' },
  already_in: { bg: '#2B2200', border: '#D97706', icon: <HourglassEmptyIcon sx={{ fontSize: 56, color: '#D97706' }} />, color: '#D97706', action: 'ALREADY IN' },
  completed:  { bg: '#2B2200', border: '#D97706', icon: <HourglassEmptyIcon sx={{ fontSize: 56, color: '#D97706' }} />, color: '#D97706', action: 'ALREADY DONE' },
  cooldown:   { bg: '#2B2200', border: '#D97706', icon: <HourglassEmptyIcon sx={{ fontSize: 56, color: '#D97706' }} />, color: '#D97706', action: 'WAIT' },
  invalid:    { bg: '#2B0D0D', border: '#D92D20', icon: <ErrorIcon          sx={{ fontSize: 56, color: '#D92D20' }} />, color: '#D92D20', action: 'INVALID QR' },
  error:      { bg: '#2B0D0D', border: '#D92D20', icon: <ErrorIcon          sx={{ fontSize: 56, color: '#D92D20' }} />, color: '#D92D20', action: 'ERROR' },
};

// 'tak' = sharp percussive click (check-in / checkout)
// 'warn' = soft lower tone (cooldown / already in)
// 'error' = short low buzz (invalid / error)
const playSound = (type = 'tak') => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    if (type === 'tak') {
      // Sharp bright click-ting
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.55, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(); osc.stop(ctx.currentTime + 0.13);
    } else if (type === 'checkout') {
      // Slightly lower double-tak
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      osc.start(); osc.stop(ctx.currentTime + 0.14);
    } else if (type === 'warn') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    } else {
      // Error — low buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    }
  } catch (_) {}
};

// ── Main component ────────────────────────────────────────────────────────────
const ScannerView = () => {
  const dispatch    = useDispatch();
  const authData    = useSelector(s => s.auth.authData);
  const companyId   = authData?.company;
  const companyName = useSelector(s => s.companies?.selectedCompany?.name) || authData?.companyName || 'The Learning Centre';

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const loopRef    = useRef(null);
  const coolRef    = useRef(false);

  const [active,    setActive]    = useState(false);
  const [starting,  setStarting]  = useState(false);
  const [camError,  setCamError]  = useState(null);
  const [settings,  setSettings]  = useState({ cooldownSeconds: 60, soundEnabled: true });
  const [feedback,  setFeedback]  = useState(null);  // { type, userName, userType, userInfo, message, checkIn, checkOut, duration }
  const [showFB,    setShowFB]    = useState(false);

  const cooldownMs = (settings?.cooldownSeconds ?? 60) * 1000;

  // ── Load settings ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    fetchQRSettings(companyId)
      .then(r => setSettings(r.data))
      .catch(() => {});
  }, [companyId]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      setCamError(
        err.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera in browser settings.' :
        err.name === 'NotFoundError'   ? 'No camera found on this device.' :
        `Camera error: ${err.message}`
      );
    } finally {
      setStarting(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    setActive(false);
    setCamError(null);
  }, []);

  // Auto-start on mount
  useEffect(() => {
    startCamera();
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line

  // ── Scan loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    loopRef.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });

      if (code?.data && !coolRef.current) {
        coolRef.current = true;
        handleScan(code.data);
        setTimeout(() => { coolRef.current = false; }, cooldownMs);
      }
    }, 200);
    return () => clearInterval(loopRef.current);
  }, [active, cooldownMs]); // eslint-disable-line

  // ── Handle scan result ─────────────────────────────────────────────────────
  const handleScan = useCallback(async (rawQR) => {
    if (!rawQR.startsWith('TLC-QR-')) {
      showFeedback({ type: 'invalid', message: 'Not a valid attendance QR' });
      playSound('error');
      return;
    }
    try {
      const { data } = await processQRScan({ rawQR, companyId });
      showFeedback(data);
      if (data.type === 'checkin')  playSound('tak');
      else if (data.type === 'checkout') playSound('checkout');
      else if (['cooldown','already_in','completed'].includes(data.type)) playSound('warn');
      else playSound('error');
    } catch (err) {
      const payload = err.response?.data || {};
      showFeedback({ type: payload.type || 'error', message: payload.message || 'Scan failed', userName: payload.userName });
      playSound('error');
    }
  }, [companyId]);

  const showFeedback = (data) => {
    setFeedback(data);
    setShowFB(true);
    setTimeout(() => setShowFB(false), 3500);
  };

  const fb = feedback ? (FEEDBACK[feedback.type] || FEEDBACK.invalid) : null;

  return (
    <Box sx={{
      width: '100vw', height: '100vh',
      bgcolor: DARK_BG,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
      userSelect: 'none',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{
        px: 4, py: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${BORDER}`,
        bgcolor: CARD_DARK,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 3, height: 24, borderRadius: 2, bgcolor: QB_GREEN }} />
          <Box>
            <Typography sx={{ fontSize: '0.72rem', color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
              {companyName}
            </Typography>
            <Typography sx={{ fontSize: '1rem', color: '#F0F6FC', fontWeight: 800, lineHeight: 1.3 }}>
              Attendance Scanner
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: active ? QB_GREEN : '#D92D20',
              boxShadow: active ? `0 0 8px ${QB_GREEN}` : 'none',
              animation: active ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
            }} />
            <Typography sx={{ fontSize: '0.72rem', color: active ? QB_GREEN : '#D92D20', fontWeight: 700 }}>
              {active ? 'LIVE' : 'OFFLINE'}
            </Typography>
          </Box>

          {/* Stop / Start camera toggle */}
          <Box
            onClick={active ? stopCamera : startCamera}
            sx={{
              px: 1.5, py: 0.4, borderRadius: 1.5, cursor: 'pointer', fontWeight: 700,
              fontSize: '0.72rem', letterSpacing: '0.04em',
              bgcolor: active ? alpha('#D92D20', 0.15) : alpha(QB_GREEN, 0.15),
              color:   active ? '#D92D20'              : QB_GREEN,
              border: `1px solid ${active ? alpha('#D92D20', 0.4) : alpha(QB_GREEN, 0.4)}`,
              transition: 'all 0.2s',
              '&:hover': { opacity: 0.8 },
              userSelect: 'none',
            }}
          >
            {starting ? '…' : active ? '⏹ Stop Camera' : '▶ Start Camera'}
          </Box>

          <Typography
            onClick={() => dispatch(logout())}
            sx={{ fontSize: '0.72rem', color: '#8B949E', cursor: 'pointer', '&:hover': { color: '#D92D20' } }}
          >
            Logout
          </Typography>
        </Box>
      </Box>

      {/* ── Camera area ─────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, position: 'relative' }}>
        <Box sx={{
          position: 'relative',
          width: '100%', maxWidth: 720,
          aspectRatio: '4/3',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: '#000',
          border: `2px solid ${active ? QB_GREEN : BORDER}`,
          boxShadow: active ? `0 0 32px ${alpha(QB_GREEN, 0.25)}` : 'none',
          transition: 'border-color 0.3s, box-shadow 0.4s',
        }}>
          <video ref={videoRef} playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: active ? 'block' : 'none' }} />

          {/* Corner brackets */}
          {active && (
            <>
              {[{ top: 20, left: 20 }, { top: 20, right: 20 }, { bottom: 20, left: 20 }, { bottom: 20, right: 20 }].map((pos, i) => (
                <Box key={i} sx={{
                  position: 'absolute', ...pos, width: 40, height: 40,
                  borderTop:    i < 2  ? `3px solid ${QB_GREEN}` : 'none',
                  borderBottom: i >= 2 ? `3px solid ${QB_GREEN}` : 'none',
                  borderLeft:   i % 2 === 0 ? `3px solid ${QB_GREEN}` : 'none',
                  borderRight:  i % 2 === 1 ? `3px solid ${QB_GREEN}` : 'none',
                  borderRadius: ['4px 0 0 0', '0 4px 0 0', '0 0 0 4px', '0 0 4px 0'][i],
                }} />
              ))}
              {/* Scan line */}
              <Box sx={{
                position: 'absolute', left: '12%', right: '12%', height: 2,
                bgcolor: alpha(QB_GREEN, 0.8),
                boxShadow: `0 0 10px ${QB_GREEN}, 0 0 20px ${alpha(QB_GREEN, 0.5)}`,
                animation: 'scanline 2.5s ease-in-out infinite',
                '@keyframes scanline': { '0%,100%': { top: '18%' }, '50%': { top: '82%' } },
              }} />
            </>
          )}

          {/* Idle / error state */}
          {!active && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
              {starting ? (
                <>
                  <CircularProgress sx={{ color: QB_GREEN }} size={48} />
                  <Typography sx={{ color: '#8B949E' }}>Starting camera…</Typography>
                </>
              ) : camError ? (
                <>
                  <ErrorIcon sx={{ fontSize: 56, color: '#D92D20' }} />
                  <Typography sx={{ color: '#8B949E', textAlign: 'center', maxWidth: 360, fontSize: '0.9rem' }}>{camError}</Typography>
                  <Box
                    onClick={startCamera}
                    sx={{ px: 3, py: 1, borderRadius: 2, bgcolor: QB_GREEN, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.85rem', '&:hover': { bgcolor: '#238A15' } }}
                  >
                    Retry Camera
                  </Box>
                </>
              ) : (
                <>
                  <QrCodeScannerIcon sx={{ fontSize: 72, color: BORDER }} />
                  <Typography sx={{ color: '#8B949E' }}>Camera loading…</Typography>
                </>
              )}
            </Box>
          )}
        </Box>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </Box>

      {/* ── Bottom status bar ────────────────────────────────────────────── */}
      <Box sx={{
        px: 4, py: 1.5, flexShrink: 0,
        borderTop: `1px solid ${BORDER}`, bgcolor: CARD_DARK,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: '0.8rem', color: '#8B949E', fontWeight: 600, letterSpacing: '0.04em' }}>
          {active ? '● Hold your QR card steady in front of the camera' : '● Camera initializing…'}
        </Typography>
      </Box>

      {/* ── Feedback overlay ─────────────────────────────────────────────── */}
      <Fade in={showFB} timeout={{ enter: 200, exit: 600 }}>
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          bgcolor: fb ? alpha(fb.bg, 0.92) : 'transparent',
          backdropFilter: 'blur(6px)',
          zIndex: 99,
          pointerEvents: showFB ? 'auto' : 'none',
        }}>
          {fb && (
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              p: 5, borderRadius: 4,
              border: `2px solid ${fb.border}`,
              bgcolor: alpha(fb.bg, 0.9),
              boxShadow: `0 0 40px ${alpha(fb.border, 0.4)}`,
              minWidth: 320, maxWidth: 480,
              textAlign: 'center',
            }}>
              {/* Big icon */}
              {fb.icon}

              {/* Action label */}
              <Chip
                label={fb.action}
                sx={{
                  bgcolor: alpha(fb.border, 0.15),
                  color: fb.color, fontWeight: 900,
                  fontSize: '0.9rem', height: 32,
                  border: `1px solid ${alpha(fb.border, 0.4)}`,
                  letterSpacing: '0.1em',
                }}
              />

              {/* Name (biggest text) */}
              {feedback?.userName && (
                <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: '#F0F6FC', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                  {feedback.userName}
                </Typography>
              )}

              {/* Role + info */}
              {(feedback?.userType || feedback?.userInfo) && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {feedback?.userType && (
                    <Chip label={feedback.userType} size="small"
                      sx={{ bgcolor: alpha(QB_GREEN, 0.15), color: QB_GREEN, fontWeight: 700, fontSize: '0.72rem' }} />
                  )}
                  {feedback?.userInfo && (
                    <Chip label={feedback.userInfo} size="small"
                      sx={{ bgcolor: alpha('#F0F6FC', 0.08), color: '#8B949E', fontWeight: 600, fontSize: '0.72rem' }} />
                  )}
                </Box>
              )}

              {/* Time */}
              {(feedback?.checkIn || feedback?.checkOut) && (
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: fb.color }}>
                  {feedback.checkIn && !feedback.checkOut
                    ? `${new Date(feedback.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : feedback.checkOut
                    ? `Out: ${new Date(feedback.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${feedback.duration ? ` · ${feedback.duration} min` : ''}`
                    : ''}
                </Typography>
              )}

              {/* Error/warning message */}
              {feedback?.type !== 'checkin' && feedback?.type !== 'checkout' && feedback?.message && (
                <Typography sx={{ fontSize: '0.85rem', color: '#8B949E', maxWidth: 360 }}>
                  {feedback.message}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Fade>
    </Box>
  );
};

export default ScannerView;
