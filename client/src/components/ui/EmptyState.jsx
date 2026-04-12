import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import ActionButton from './ActionButton';

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: compact ? 4 : 8,
        px: 2,
        textAlign: 'center'
      }}
    >
      {Icon && (
        <Box
          sx={{
            width: compact ? 60 : 80,
            height: compact ? 60 : 80,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: alpha(theme.palette.primary.main, 0.6),
            mb: 2
          }}
        >
          <Icon sx={{ fontSize: compact ? 32 : 40 }} />
        </Box>
      )}

      <Typography
        variant={compact ? 'subtitle1' : 'h6'}
        fontWeight={700}
        color="text.primary"
        sx={{ mb: 0.5 }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: actionLabel ? 3 : 0, maxWidth: 400 }}
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
