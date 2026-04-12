import React from 'react';
import { Card, CardContent, Box, Typography, useTheme, alpha } from '@mui/material';

const StatCard = ({ title, value, icon, color, subtitle, trend, onClick }) => {
    const theme = useTheme();
    
    // Defensive checks to prevent React errors
    const safeValue = value !== undefined && value !== null ? value : '0';
    const safeTitle = title || 'Stat';
    const safeColor = color ? (theme.palette[color]?.main || color) : theme.palette.primary.main;
    const safeIcon = icon || null;
    
    return (
        <Card 
            onClick={onClick}
            sx={{ 
                height: '100%', 
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                cursor: onClick ? 'pointer' : 'default',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: theme.shadows[4] 
                } 
            }}
        >
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ flexGrow: 1, mr: 2 }}>
                        <Typography 
                            variant="caption" 
                            fontWeight={700} 
                            sx={{ 
                                color: 'text.secondary', 
                                textTransform: 'uppercase', 
                                letterSpacing: 0.5,
                                display: 'block',
                                mb: 0.5
                            }}
                        >
                            {safeTitle}
                        </Typography>
                        <Typography 
                            variant="h5" 
                            fontWeight={800} 
                            sx={{ 
                                color: 'text.primary',
                                mb: 0.5
                            }}
                        >
                            {safeValue}
                        </Typography>
                        
                        {(subtitle || trend) && (
                            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                {trend && (
                                    <Typography 
                                        variant="caption" 
                                        sx={{ 
                                            color: safeColor, 
                                            bgcolor: alpha(safeColor, 0.1), 
                                            px: 1, 
                                            py: 0.5, 
                                            borderRadius: 1, 
                                            fontWeight: 700 
                                        }}
                                    >
                                        {trend}
                                    </Typography>
                                )}
                                {subtitle && (
                                    <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
                                        {subtitle}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                    
                    <Box sx={{ 
                        color: safeColor,
                        bgcolor: alpha(safeColor, 0.1),
                        p: 1.5,
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 48,
                        minHeight: 48
                    }}>
                        {safeIcon && React.cloneElement(safeIcon, { sx: { fontSize: 24 } })}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default StatCard;
