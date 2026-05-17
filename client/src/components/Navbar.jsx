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
  // Single-company mode: prefer the fully-loaded company doc, fall back to companyName from login.
  const companyName = selectedCompany?.name || authData?.companyName || null;

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

  const qbGreen = '#2CA01C';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { lg: `calc(100% - ${drawerWidth}px)` },
        ml: { lg: `${drawerWidth}px` },
        bgcolor: '#ffffff',
        color: 'text.primary',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        height: 56,
        justifyContent: 'center',
      }}
    >
      <Toolbar sx={{
        minHeight: '56px !important',
        px: { xs: 2, sm: 3 },
        justifyContent: 'space-between',
      }}>
        {/* Left: mobile menu + company name */}
        <Box display="flex" alignItems="center" gap={1.5}>
          <IconButton
            size="small"
            onClick={handleDrawerToggle}
            sx={{ display: { lg: 'none' }, color: 'text.secondary' }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>

          {companyName && (
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 3, height: 18, borderRadius: 2, bgcolor: qbGreen }} />
              <Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                  Current Center
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: qbGreen, lineHeight: 1.3 }}>
                  {companyName}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Right: icons + user */}
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton size="small" sx={{ color: '#9CA3AF', '&:hover': { color: qbGreen, bgcolor: alpha(qbGreen, 0.06) }, borderRadius: '8px' }}>
            <SearchIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>
          <IconButton size="small" sx={{ color: '#9CA3AF', '&:hover': { color: qbGreen, bgcolor: alpha(qbGreen, 0.06) }, borderRadius: '8px' }}>
            <NotificationsNoneIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>

          <Box sx={{ width: '1px', height: 24, bgcolor: '#E5E7EB', mx: 0.5, display: { xs: 'none', md: 'block' } }} />

          <Box display="flex" alignItems="center" gap={1.25}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#3D3D3D', lineHeight: 1.2 }}>
                {authData?.name || 'User'}
              </Typography>
              <Chip
                label={getRoleLabel(authData?.role)}
                size="small"
                color={getRoleColor(authData?.role)}
                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, mt: 0.25 }}
              />
            </Box>
            <Avatar sx={{
              bgcolor: qbGreen,
              width: 34, height: 34,
              fontSize: '0.8rem', fontWeight: 800,
              boxShadow: '0 2px 6px rgba(44,160,28,0.3)',
              border: '2px solid #fff',
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
