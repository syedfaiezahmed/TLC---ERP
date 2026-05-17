import React from 'react';
import { Box, Typography } from '@mui/material';
import ActionButton from './ActionButton';

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: compact ? 4 : 7,
        px: 3,
        textAlign: 'center',
        border: '1.5px dashed #D0D5DD',
        borderRadius: 3,
        bgcolor: '#FAFBFC',
        my: 1,
      }}
    >
      {Icon && (
        <Box sx={{
          width: compact ? 52 : 68,
          height: compact ? 52 : 68,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(44,160,28,0.08)',
          color: '#2CA01C',
          mb: 2,
        }}>
          <Icon sx={{ fontSize: compact ? 26 : 34 }} />
        </Box>
      )}

      <Typography
        variant={compact ? 'subtitle2' : 'subtitle1'}
        fontWeight={700}
        sx={{ color: '#3D3D3D', mb: 0.5 }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: actionLabel ? 2.5 : 0, maxWidth: 360, lineHeight: 1.6 }}
        >
          {description}
        </Typography>
      )}

      {actionLabel && onAction && (
        <ActionButton
          variant="contained"
          color="primary"
          onClick={onAction}
          size={compact ? 'small' : 'medium'}
        >
          {actionLabel}
        </ActionButton>
      )}
    </Box>
  );
};

export default EmptyState;
