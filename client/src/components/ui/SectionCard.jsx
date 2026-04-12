import React from 'react';
import { Card, useTheme } from '@mui/material';

const SectionCard = ({ children, sx }) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        borderRadius: 4,
        boxShadow: theme.shadows[2],
        overflow: 'hidden',
        ...sx,
      }}
    >
      {children}
    </Card>
  );
};

export default SectionCard;

