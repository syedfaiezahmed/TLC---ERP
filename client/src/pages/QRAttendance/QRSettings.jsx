import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, FormControlLabel,
  Slider, Button, CircularProgress, alpha, Divider, Chip
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useDispatch, useSelector } from 'react-redux';
import { loadQRSettings, saveQRSettings } from '../../redux/qrAttendanceSlice';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

const QB_GREEN = '#2CA01C';

const SettingRow = ({ label, desc, children }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    py: 2, borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap', gap: 1
  }}>
    <Box>
      <Typography variant="body2" fontWeight={700} sx={{ color: '#3D3D3D' }}>{label}</Typography>
      <Typography variant="caption" sx={{ color: '#9CA3AF' }}>{desc}</Typography>
    </Box>
    <Box sx={{ flexShrink: 0 }}>
      {children}
    </Box>
  </Box>
);

const QRSettings = () => {
  const dispatch = useDispatch();
  const { companyId } = useParams();
  const { settings, savingSettings } = useSelector(s => s.qrAttendance);

  const [local, setLocal] = useState({
    checkoutEnabled: false,
    cooldownSeconds: 60,
    autoStart: false,
    soundEnabled: true,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    dispatch(loadQRSettings(companyId));
  }, [dispatch, companyId]);

  useEffect(() => {
    if (settings) setLocal({ ...settings });
  }, [settings]);

  const handleSave = async () => {
    await dispatch(saveQRSettings({ companyId, ...local }));
    setSaved(true);
    toast.success('Settings saved!');
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: '#3D3D3D' }}>
            QR Attendance Settings
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 2.5 }}>
            Configure how the QR scanner behaves
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <SettingRow
            label="Check-Out Mode"
            desc="Enable a second scan to record check-out time and calculate duration"
          >
            <Switch
              checked={local.checkoutEnabled}
              onChange={e => setLocal(p => ({ ...p, checkoutEnabled: e.target.checked }))}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: local.checkoutEnabled ? QB_GREEN : undefined },
                   '& .MuiSwitch-track': { bgcolor: local.checkoutEnabled ? alpha(QB_GREEN, 0.5) : undefined } }}
            />
          </SettingRow>

          <SettingRow
            label="Camera Auto-Start"
            desc="Automatically activate webcam when the scanner page is opened"
          >
            <Switch
              checked={local.autoStart}
              onChange={e => setLocal(p => ({ ...p, autoStart: e.target.checked }))}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: local.autoStart ? QB_GREEN : undefined },
                   '& .MuiSwitch-track': { bgcolor: local.autoStart ? alpha(QB_GREEN, 0.5) : undefined } }}
            />
          </SettingRow>

          <SettingRow
            label="Sound Notifications"
            desc="Play a sound on successful scan (requires browser permission)"
          >
            <Switch
              checked={local.soundEnabled}
              onChange={e => setLocal(p => ({ ...p, soundEnabled: e.target.checked }))}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: local.soundEnabled ? QB_GREEN : undefined },
                   '& .MuiSwitch-track': { bgcolor: local.soundEnabled ? alpha(QB_GREEN, 0.5) : undefined } }}
            />
          </SettingRow>

          <Box sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#3D3D3D' }}>
                  Scan Cooldown
                </Typography>
                <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                  Minimum seconds between two scans of the same QR
                </Typography>
              </Box>
              <Chip
                label={`${local.cooldownSeconds}s`}
                sx={{ bgcolor: alpha(QB_GREEN, 0.1), color: QB_GREEN, fontWeight: 800 }}
              />
            </Box>
            <Slider
              value={local.cooldownSeconds}
              min={10} max={300} step={10}
              onChange={(_, v) => setLocal(p => ({ ...p, cooldownSeconds: v }))}
              marks={[
                { value: 10, label: '10s' },
                { value: 60, label: '60s' },
                { value: 120, label: '2m' },
                { value: 300, label: '5m' },
              ]}
              sx={{
                color: QB_GREEN,
                '& .MuiSlider-thumb': { bgcolor: QB_GREEN },
                '& .MuiSlider-track': { bgcolor: QB_GREEN },
                '& .MuiSlider-markLabel': { fontSize: '0.7rem', color: '#9CA3AF' },
              }}
            />
          </Box>

          <Divider sx={{ mt: 1, mb: 2.5 }} />

          <Button
            variant="contained"
            startIcon={saved ? <CheckCircleIcon /> : savingSettings ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={savingSettings}
            sx={{
              bgcolor: saved ? '#238A15' : QB_GREEN,
              '&:hover': { bgcolor: '#238A15' },
              fontWeight: 700, borderRadius: 2, px: 4,
            }}
          >
            {saved ? 'Saved!' : savingSettings ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QRSettings;
