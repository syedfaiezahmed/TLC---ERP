import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  useTheme,
  Chip,
  alpha
} from '@mui/material';
import { useSelector } from 'react-redux';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';

const Navbar = React.memo(({ drawerWidth, handleDrawerToggle }) => {
  const theme = useTheme();
  const authData = useSelector((state) => state.auth.authData);
  const selectedCompany = useSelector((state) => state.companies.selectedCompany);

  const getInitials = React.useCallback((name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }, []);

  const getRoleColor = (role) => {
    const roleColors = {
      superadmin: 'error',
      admin: 'primary',
      accountant: 'success',
      teacher: 'info',
      student: 'warning',
      user: 'default'
    };
    return roleColors[role] || 'default';
  };

  const getRoleLabel = (role) => {
    const roleLabels = {
      superadmin: 'Super Admin',
      admin: 'Admin',
      accountant: 'Accountant',
      teacher: 'Teacher',
      student: 'Student',
      user: 'User'
    };
    return roleLabels[role] || 'User';
  };

  return (
    <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent matching background
          backdropFilter: 'blur(12px)',
          color: 'text.primary',
          borderBottom: 'none',
          pt: 1,
          pr: 2
        }}
      >
        <Toolbar sx={{ 
            minHeight: 64, 
            bgcolor: 'background.paper', 
            borderRadius: 2.5, 
            mx: { xs: 1, sm: 2 }, 
            my: 1, 
            px: { xs: 2, sm: 3 },
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
            border: '1px solid',
            borderColor: 'divider',
            justifyContent: 'space-between'
        }}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ display: { lg: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            
            {selectedCompany && (
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Current Center
                </Typography>
                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ lineHeight: 1.2 }}>
                  {selectedCompany.name}
                </Typography>
              </Box>
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1.5}>
              <IconButton 
                size="small" 
                sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                }}
              >
                <SearchIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
              </IconButton>
              
              <IconButton 
                size="small"
                sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                }}
              >
                <NotificationsNoneIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
              </IconButton>

              <Box sx={{ height: 32, width: '1px', bgcolor: 'divider', mx: 0.5, display: { xs: 'none', md: 'block' } }} />

              <Box display="flex" alignItems="center" gap={1.5}>
                  <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                      <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2} sx={{ mb: 0.25 }}>
                          {authData?.name || 'User'}
                      </Typography>
                      <Chip 
                        label={getRoleLabel(authData?.role)} 
                        size="small" 
                        color={getRoleColor(authData?.role)}
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                      />
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.primary.main, 
                    width: 40, 
                    height: 40, 
                    fontSize: '0.9rem', 
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(30, 64, 175, 0.2)',
                    border: '2px solid',
                    borderColor: 'background.paper'
                  }}>
                      {getInitials(authData?.name)}
                  </Avatar>
              </Box>
          </Box>
        </Toolbar>
    </AppBar>
  );
});

export default Navbar;
