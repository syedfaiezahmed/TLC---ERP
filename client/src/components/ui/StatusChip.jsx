import React from 'react';
import { Chip } from '@mui/material';

const StatusChip = ({ status, label, size = 'small' }) => {
  const getStatusColor = (status) => {
    const statusMap = {
      active: 'success',
      inactive: 'default',
      pending: 'warning',
      completed: 'success',
      cancelled: 'error',
      paid: 'success',
      unpaid: 'error',
      partial: 'warning',
      approved: 'success',
      rejected: 'error',
      draft: 'default',
      published: 'info'
    };
    return statusMap[status?.toLowerCase()] || 'default';
  };

  return (
    <Chip
      label={label || status}
      color={getStatusColor(status)}
      size={size}
      sx={{
        fontWeight: 700,
        textTransform: 'capitalize',
        minWidth: 70
      }}
    />
  );
};

export default StatusChip;
