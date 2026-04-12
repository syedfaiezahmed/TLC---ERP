import React from 'react';
import { Card, CardContent, Box, Typography, Avatar, alpha, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

const StatsCard = ({ 
  title, 
  value, 
  icon, 
  color = '#3B82F6',
  trend,
  trendUp = true,
  subtitle,
  onClick
}) => {
  const theme = useTheme();

  return (
    <Card 
      sx={{ 
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Avatar 
            sx={{ 
              bgcolor: alpha(color, 0.1), 
              color: color,
              width: 48,
              height: 48,
              borderRadius: 1
            }}
          >
            {icon && React.cloneElement(icon, { sx: { fontSize: '1.5rem' } })}
          </Avatar>
          
          {trend && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: 0.5,
                bgcolor: alpha(trendUp ? theme.palette.success.main : theme.palette.error.main, 0.1),
                color: trendUp ? 'success.main' : 'error.main'
              }}
            >
              {trendUp ? <TrendingUpIcon sx={{ fontSize: '1rem' }} /> : <TrendingDownIcon sx={{ fontSize: '1rem' }} />}
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
                {trend}
              </Typography>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
          {title}
        </Typography>
        
        <Typography variant="h4" fontWeight={800} color="text.primary" sx={{ mb: subtitle ? 0.5 : 0 }}>
          {value}
        </Typography>

        {subtitle && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
