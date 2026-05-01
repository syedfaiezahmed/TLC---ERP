import React from 'react';
import { Link, Typography, Tooltip, Box } from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';

const toWhatsAppNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  if (digits.length === 10) return `92${digits}`;
  return digits;
};

const WhatsAppContact = ({ value, variant = 'body2', color = 'text.primary', icon = true, fontWeight, sx }) => {
  if (!value) {
    return <Typography variant={variant} color="text.secondary" sx={sx}>—</Typography>;
  }

  const whatsappNumber = toWhatsAppNumber(value);
  const href = whatsappNumber ? `https://wa.me/${whatsappNumber}` : undefined;

  return (
    <Tooltip title="Open WhatsApp">
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        color={color}
        onClick={(event) => event.stopPropagation()}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight, ...sx }}
      >
        {icon && <PhoneIcon fontSize="small" sx={{ fontSize: 14, color: 'text.secondary' }} />}
        <Box component="span" sx={{ fontSize: 'inherit' }}>{value}</Box>
      </Link>
    </Tooltip>
  );
};

export default WhatsAppContact;
