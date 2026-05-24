import React, { useRef, useState, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Box, Typography, Button, CircularProgress, alpha, Chip, Fade
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

const QB_GREEN = '#2CA01C';

// ── scan status styles ───────────────────────────────────────────────────────
const STATUS_MAP = {
  scanning:  { color: '#6B7280', icon: <QrCodeScannerIcon />, label: 'Scanning…' },
  checkin:   { color: QB_GREEN,  icon: <CheckCircleIcon />,   label: 'Check-In ✓' },
  checkout:  { color: '#0077C5', icon: <CheckCircleIcon />,   label: 'Check-Out ✓' },
  already_in:{ color: '#D97706', icon: <HourglassEmptyIcon />,label: 'Already In' },
  completed: { color: '#D97706', icon: <HourglassEmptyIcon />,label: 'Already Done' },
  cooldown:  { color: '#D97706', icon: <HourglassEmptyIcon />,label: 'Cooldown…' },
  invalid:   { color: '#D92D20', icon: <ErrorIcon />,         label: 'Invalid QR' },
  error:     { color: '#D92D20', icon: <ErrorIcon />,         label: 'Error' },
};

const QRScanner = ({ companyId, onScanResult, settings, autoStart = false }) => {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const scanLoopRef = useRef(null);
  const cooldownRef = useRef(false);

  const [active,      setActive]      = useState(false);
  const [starting,    setStarting]    = useState(false);
  const [scanStatus,  setScanStatus]  = useState('scanning');
  const [lastResult,  setLastResult]  = useState(null);
  const [camError,    setCamError]    = useState(null);
  const [detected,    setDetected]    = useState(false);  // flash overlay

  const cooldownMs = (settings?.cooldownSeconds ?? 60) * 1000;

  // ── camera ──────────────────────────────────────────────────────────────────
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
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${err.message}`;
      setCamError(msg);
    } finally {
      setStarting(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) clearInterval(scanLoopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setScanStatus('scanning');
    setLastResult(null);
    cooldownRef.current = false;
  }, []);

  // ── scan loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    scanLoopRef.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && !cooldownRef.current) {
        cooldownRef.current = true;
        setDetected(true);
        setTimeout(() => setDetected(false), 500);

        // Call parent handler with decoded string
        onScanResult(code.data).then(result => {
          if (result) {
            setScanStatus(result.type || (result.success ? 'checkin' : 'error'));
            setLastResult(result);
          }
          // Reset cooldown after configured time
          setTimeout(() => {
            cooldownRef.current = false;
            setScanStatus('scanning');
          }, cooldownMs);
        }).catch(() => {
          setScanStatus('error');
          setTimeout(() => {
            cooldownRef.current = false;
            setScanStatus('scanning');
          }, 3000);
        });
      }
    }, 200); // scan every 200 ms

    return () => clearInterval(scanLoopRef.current);
  }, [active, onScanResult, cooldownMs]);

  // Auto-start
  useEffect(() => {
    if (autoStart) startCamera();
    return () => stopCamera();
  }, [autoStart]); // eslint-disable-line

  const statusStyle = STATUS_MAP[scanStatus] || STATUS_MAP.scanning;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>

      {/* ── Camera viewport ───────────────────────────────────────────── */}
      <Box sx={{
        position: 'relative',
        width: '100%', maxWidth: 520,
        aspectRatio: '4/3',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: '#0F172A',
        border: `2px solid ${active ? QB_GREEN : '#374151'}`,
        boxShadow: active ? `0 0 0 3px ${alpha(QB_GREEN, 0.25)}` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}>
        {/* Video element */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: active ? 'block' : 'none' }}
        />

        {/* Scanning overlay — corner brackets */}
        {active && (
          <>
            {/* Corner brackets */}
            {[{top:16,left:16},{top:16,right:16},{bottom:16,left:16},{bottom:16,right:16}].map((pos,i) => (
              <Box key={i} sx={{
                position: 'absolute', ...pos,
                width: 32, height: 32,
                borderTop:    (i < 2) ? `3px solid ${QB_GREEN}` : 'none',
                borderBottom: (i >= 2) ? `3px solid ${QB_GREEN}` : 'none',
                borderLeft:   (i % 2 === 0) ? `3px solid ${QB_GREEN}` : 'none',
                borderRight:  (i % 2 === 1) ? `3px solid ${QB_GREEN}` : 'none',
                borderRadius: i === 0 ? '4px 0 0 0' : i === 1 ? '0 4px 0 0' : i === 2 ? '0 0 0 4px' : '0 0 4px 0',
              }} />
            ))}
            {/* Horizontal scan line animation */}
            <Box sx={{
              position: 'absolute', left: '10%', right: '10%', height: 2,
              bgcolor: alpha(QB_GREEN, 0.8),
              boxShadow: `0 0 8px ${QB_GREEN}`,
              animation: 'scanline 2s linear infinite',
              '@keyframes scanline': {
                '0%':   { top: '15%' },
                '50%':  { top: '85%' },
                '100%': { top: '15%' },
              },
            }} />
          </>
        )}

        {/* QR detected flash */}
        <Fade in={detected}>
          <Box sx={{
            position: 'absolute', inset: 0,
            bgcolor: alpha(QB_GREEN, 0.25),
            pointerEvents: 'none',
          }} />
        </Fade>

        {/* Idle / error placeholder */}
        {!active && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 1.5,
          }}>
            {camError ? (
              <>
                <ErrorIcon sx={{ fontSize: 48, color: '#EF4444' }} />
                <Typography variant="body2" sx={{ color: '#9CA3AF', textAlign: 'center', px: 3 }}>
                  {camError}
                </Typography>
              </>
            ) : (
              <>
                <QrCodeScannerIcon sx={{ fontSize: 64, color: '#4B5563' }} />
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Camera is off
                </Typography>
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Status chip ─────────────────────────────────────────────────── */}
      {active && (
        <Chip
          icon={<Box sx={{ display:'flex', color: statusStyle.color }}>{statusStyle.icon}</Box>}
          label={lastResult?.message || statusStyle.label}
          sx={{
            bgcolor: alpha(statusStyle.color, 0.1),
            color: statusStyle.color,
            fontWeight: 700,
            fontSize: '0.85rem',
            height: 36,
            border: `1px solid ${alpha(statusStyle.color, 0.3)}`,
            maxWidth: 400,
            '& .MuiChip-label': { px: 1.5 },
          }}
        />
      )}

      {/* ── User result card ─────────────────────────────────────────────── */}
      {lastResult && lastResult.userName && (
        <Fade in>
          <Box sx={{
            width: '100%', maxWidth: 520,
            p: 2, borderRadius: 2,
            bgcolor: alpha(statusStyle.color, 0.07),
            border: `1px solid ${alpha(statusStyle.color, 0.25)}`,
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography fontWeight={700} sx={{ color: '#3D3D3D' }}>
                {lastResult.userName}
              </Typography>
              <Chip
                label={lastResult.userType}
                size="small"
                sx={{ bgcolor: alpha(QB_GREEN, 0.1), color: QB_GREEN, fontWeight: 700, fontSize: '0.7rem' }}
              />
            </Box>
            {lastResult.userInfo && (
              <Typography variant="caption" sx={{ color: '#6B7280' }}>{lastResult.userInfo}</Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
              {lastResult.checkIn && (
                <Typography variant="caption" sx={{ color: QB_GREEN, fontWeight: 600 }}>
                  In: {new Date(lastResult.checkIn).toLocaleTimeString()}
                </Typography>
              )}
              {lastResult.checkOut && (
                <Typography variant="caption" sx={{ color: '#0077C5', fontWeight: 600 }}>
                  Out: {new Date(lastResult.checkOut).toLocaleTimeString()}
                </Typography>
              )}
              {lastResult.duration > 0 && (
                <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>
                  Duration: {lastResult.duration} min
                </Typography>
              )}
            </Box>
          </Box>
        </Fade>
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        {!active ? (
          <Button
            variant="contained"
            size="large"
            startIcon={starting ? <CircularProgress size={18} color="inherit" /> : <VideocamIcon />}
            onClick={startCamera}
            disabled={starting}
            sx={{
              bgcolor: QB_GREEN, '&:hover': { bgcolor: '#238A15' },
              fontWeight: 700, borderRadius: 2, px: 4,
            }}
          >
            {starting ? 'Starting…' : 'Start Scanner'}
          </Button>
        ) : (
          <Button
            variant="outlined"
            size="large"
            startIcon={<VideocamOffIcon />}
            onClick={stopCamera}
            sx={{
              borderColor: '#D92D20', color: '#D92D20',
              '&:hover': { bgcolor: alpha('#D92D20', 0.06), borderColor: '#D92D20' },
              fontWeight: 700, borderRadius: 2, px: 4,
            }}
          >
            Stop Scanner
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default QRScanner;
