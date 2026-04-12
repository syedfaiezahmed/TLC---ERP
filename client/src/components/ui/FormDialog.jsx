import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ActionButton from './ActionButton';

const FormDialog = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  loading = false,
  maxWidth = 'sm',
  fullWidth = true
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 2 }}>
        {children}
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
          onClick={onSubmit}
          variant="contained"
          color="primary"
          loading={loading}
        >
          {submitLabel}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
};

export default FormDialog;
