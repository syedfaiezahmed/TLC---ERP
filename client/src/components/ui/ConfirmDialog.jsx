import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  alpha,
  useTheme
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ActionButton from './ActionButton';

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  severity = 'warning'
}) => {
  const theme = useTheme();

  const severityConfig = {
    warning: {
      color: theme.palette.warning.main,
      bgcolor: alpha(theme.palette.warning.main, 0.1)
    },
    error: {
      color: theme.palette.error.main,
      bgcolor: alpha(theme.palette.error.main, 0.1)
    },
    info: {
      color: theme.palette.info.main,
      bgcolor: alpha(theme.palette.info.main, 0.1)
    }
  };

  const config = severityConfig[severity] || severityConfig.warning;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
        }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: config.bgcolor,
              color: config.color
            }}
          >
            <WarningAmberIcon />
          </Box>
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <ActionButton
          onClick={onClose}
          variant="outlined"
          disabled={loading}
        >
          {cancelLabel}
        </ActionButton>
        <ActionButton
          onClick={onConfirm}
          variant="contained"
          color={severity === 'error' ? 'error' : 'primary'}
          loading={loading}
        >
          {confirmLabel}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
