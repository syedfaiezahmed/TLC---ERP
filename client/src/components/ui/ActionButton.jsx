import React from 'react';
import { Button, CircularProgress } from '@mui/material';

const ActionButton = ({
  children,
  loading = false,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  startIcon,
  endIcon,
  onClick,
  disabled,
  fullWidth = false,
  ...props
}) => {
  return (
    <Button
      variant={variant}
      color={color}
      size={size}
      startIcon={!loading && startIcon}
      endIcon={!loading && endIcon}
      onClick={onClick}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      {...props}
    >
      {loading ? (
        <CircularProgress 
          size={size === 'small' ? 16 : size === 'large' ? 24 : 20} 
          thickness={4}
          sx={{ color: 'inherit' }}
        />
      ) : (
        children
      )}
    </Button>
  );
};

export default ActionButton;
