import React from 'react';
import { Box, Typography } from '@mui/material';

const PageHeader = ({ title, subtitle, actions }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 4 }}>
      <Box>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body1" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>{actions}</Box> : null}
    </Box>
  );
};

export default PageHeader;

