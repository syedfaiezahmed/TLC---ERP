import React from 'react';
import { Box, Typography } from '@mui/material';

const PageHeader = ({ title, subtitle, actions }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ width: 4, height: subtitle ? 44 : 28, borderRadius: 2, bgcolor: '#2CA01C', flexShrink: 0, mt: 0.25 }} />
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: '#3D3D3D', lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;

