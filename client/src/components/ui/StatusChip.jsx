import React from 'react';
import { Box, Typography } from '@mui/material';

const STATUS_PALETTE = {
  active:    { dot: '#2CA01C', bg: 'rgba(44,160,28,0.1)',   text: '#1E7B14' },
  paid:      { dot: '#2CA01C', bg: 'rgba(44,160,28,0.1)',   text: '#1E7B14' },
  approved:  { dot: '#2CA01C', bg: 'rgba(44,160,28,0.1)',   text: '#1E7B14' },
  completed: { dot: '#2CA01C', bg: 'rgba(44,160,28,0.1)',   text: '#1E7B14' },
  published: { dot: '#0077C5', bg: 'rgba(0,119,197,0.1)',   text: '#005A99' },
  pending:   { dot: '#D97706', bg: 'rgba(217,119,6,0.1)',   text: '#B45309' },
  partial:   { dot: '#D97706', bg: 'rgba(217,119,6,0.1)',   text: '#B45309' },
  unpaid:    { dot: '#D92D20', bg: 'rgba(217,45,32,0.1)',   text: '#B42318' },
  cancelled: { dot: '#D92D20', bg: 'rgba(217,45,32,0.1)',   text: '#B42318' },
  rejected:  { dot: '#D92D20', bg: 'rgba(217,45,32,0.1)',   text: '#B42318' },
  inactive:  { dot: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', text: '#6B7280' },
  draft:     { dot: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', text: '#6B7280' },
};

const StatusChip = ({ status, label }) => {
  const key = status?.toLowerCase();
  const p = STATUS_PALETTE[key] || { dot: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', text: '#6B7280' };

  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      px: 1, py: 0.3,
      borderRadius: '20px',
      bgcolor: p.bg,
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: p.dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: p.text, textTransform: 'capitalize', lineHeight: 1 }}>
        {label || status}
      </Typography>
    </Box>
  );
};

export default StatusChip;
