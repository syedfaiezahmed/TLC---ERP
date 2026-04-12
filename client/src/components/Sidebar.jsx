import React, { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/authSlice';
import {
  Box,
  Drawer,
  List,
  Typography,
  Toolbar,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Button,
  useTheme,
  Divider,
  alpha,
  IconButton,
  Tooltip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BackupIcon from '@mui/icons-material/Backup';
import LogoutIcon from '@mui/icons-material/Logout';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import PaymentsIcon from '@mui/icons-material/Payments';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import BookIcon from '@mui/icons-material/Book';
import LockIcon from '@mui/icons-material/Lock';
import HistoryIcon from '@mui/icons-material/History';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContactSupportIcon from '@mui/icons-material/ContactSupport';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import InventoryIcon from '@mui/icons-material/Inventory';
import PayrollIcon from '@mui/icons-material/RequestQuote';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsIcon from '@mui/icons-material/Groups';

const Sidebar = React.memo(({ mobileOpen, handleDrawerToggle }) => {
  const { companyId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const authData = useSelector((state) => state.auth.authData);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const drawerWidth = isCollapsed ? 72 : 240;

  const handleLogout = React.useCallback(() => {
    dispatch(logout());
    navigate('/login');
  }, [dispatch, navigate]);

  const userRole = authData?.role || 'user';
  const isAdmin = ['superadmin', 'admin'].includes(userRole);
  const isAccountant = ['superadmin', 'admin', 'accountant'].includes(userRole);
  const isTeacher = ['superadmin', 'admin', 'teacher'].includes(userRole);
  const isStudent = userRole === 'student';

  const menuItems = React.useMemo(() => {
    const items = [
      { text: 'Overview', icon: <DashboardIcon />, path: `/company/${companyId}/dashboard`, roles: ['all'] },
    ];

    if (!isStudent) {
      items.push(
        { type: 'divider' },
        { text: 'ACADEMICS', type: 'header' },
        { text: 'Enquiries', icon: <ContactSupportIcon />, path: `/company/${companyId}/enquiries`, roles: ['superadmin', 'admin'] },
        { text: 'Courses', icon: <AutoStoriesIcon />, path: `/company/${companyId}/courses`, roles: ['superadmin', 'admin', 'teacher'] },
        { text: 'Batches', icon: <GroupsIcon />, path: `/company/${companyId}/batches`, roles: ['superadmin', 'admin', 'teacher'] },
        { text: 'Attendance', icon: <EventAvailableIcon />, path: `/company/${companyId}/attendance`, roles: ['superadmin', 'admin', 'teacher'] },
        { text: 'Exams & Results', icon: <AssignmentIcon />, path: `/company/${companyId}/exams`, roles: ['superadmin', 'admin', 'teacher'] },
      );
    }

    items.push(
      { type: 'divider' },
      { text: 'STUDENTS & FEES', type: 'header' },
    );

    if (!isStudent) {
      items.push(
        { text: 'Students', icon: <PeopleIcon />, path: `/company/${companyId}/students`, roles: ['superadmin', 'admin', 'teacher'] },
      );
    }

    if (isAdmin) {
      items.push(
        { text: 'Enrollments', icon: <SchoolIcon />, path: `/company/${companyId}/enrollments`, roles: ['superadmin', 'admin'] },
      );
    }

    if (isAccountant || isAdmin) {
      items.push(
        { text: 'Fee Management', icon: <PaymentsIcon />, path: `/company/${companyId}/fee-management`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Student Statement', icon: <AttachMoneyIcon />, path: `/company/${companyId}/payments`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Fee Refunds', icon: <AssignmentReturnIcon />, path: `/company/${companyId}/fee-refunds`, roles: ['superadmin', 'admin', 'accountant'] },
      );
    }

    if (isAdmin || isAccountant) {
      items.push(
        { type: 'divider' },
        { text: 'FACULTY & EXPENSES', type: 'header' },
      );
    }

    if (isAdmin) {
      items.push(
        { text: 'Teachers', icon: <SupervisorAccountIcon />, path: `/company/${companyId}/teachers`, roles: ['superadmin', 'admin'] },
      );
    }

    if (isAccountant || isAdmin) {
      items.push(
        { text: 'Bills / Purchases', icon: <BookIcon />, path: `/company/${companyId}/purchases`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Bill Payments', icon: <AccountBalanceWalletIcon />, path: `/company/${companyId}/pays`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Purchase Returns', icon: <AssignmentReturnIcon />, path: `/company/${companyId}/purchase-returns`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Expenses', icon: <PaymentsIcon />, path: `/company/${companyId}/expenses`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Assets & Depreciation', icon: <InventoryIcon />, path: `/company/${companyId}/assets`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Payroll', icon: <PayrollIcon />, path: `/company/${companyId}/payroll`, roles: ['superadmin', 'admin', 'accountant'] },
      );
    }

    if (isAccountant || isAdmin) {
      items.push(
        { type: 'divider' },
        { text: 'FINANCIALS', type: 'header' },
        { text: 'Chart of Accounts', icon: <AccountTreeIcon />, path: `/company/${companyId}/coa`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'General Ledger', icon: <BookIcon />, path: `/company/${companyId}/ledger`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Reports', icon: <AssessmentIcon />, path: `/company/${companyId}/reports`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Fee Reports', icon: <ReceiptLongIcon />, path: `/company/${companyId}/fee-reports`, roles: ['superadmin', 'admin', 'accountant'] },
        { text: 'Period Lock', icon: <LockIcon />, path: `/company/${companyId}/period-lock`, roles: ['superadmin', 'admin'] },
        { text: 'Audit Logs', icon: <HistoryIcon />, path: `/company/${companyId}/audit-logs`, roles: ['superadmin', 'admin'] },
      );
    }

    if (isAdmin) {
      items.push(
        { type: 'divider' },
        { text: 'SYSTEM', type: 'header' },
      );
      
      if (userRole === 'superadmin') {
        items.push({ text: 'User Management', icon: <ManageAccountsIcon />, path: `/company/${companyId}/users`, roles: ['superadmin'] });
      }
      
      items.push(
        { text: 'System Backup', icon: <BackupIcon />, path: `/company/${companyId}/backup`, roles: ['superadmin', 'admin'] },
        { text: 'Settings', icon: <SettingsIcon />, path: `/company/${companyId}/settings`, roles: ['superadmin', 'admin'] },
      );
    }

    return items;
  }, [companyId, userRole, isAdmin, isAccountant, isTeacher, isStudent]);

  const drawerContent = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: '#0F172A', // Strict SaaS Deep Navy
      color: '#FFFFFF',
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
      width: drawerWidth,
      overflowX: 'hidden'
    }}>
      {/* Brand Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between',
        minHeight: 64
      }}>
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 32, 
              height: 32, 
              borderRadius: '8px', 
              bgcolor: 'primary.main',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.3)}`
            }}>
              <SchoolIcon sx={{ color: 'white', fontSize: '1.2rem' }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1} sx={{ color: 'white' }}>
                TLC
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#FFF', 0.4), fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ERP SUITE
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton 
          size="small"
          onClick={() => setIsCollapsed(!isCollapsed)}
          sx={{ color: alpha('#FFF', 0.5), '&:hover': { bgcolor: alpha('#FFF', 0.1) } }}
        >
          {isCollapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Navigation List */}
      <List sx={{ px: 1.5, flexGrow: 1, py: 1, overflowY: 'auto' }}>
        {menuItems.map((item, index) => {
          if (item.type === 'divider') return <Divider key={index} sx={{ my: 1.5, mx: 1, bgcolor: alpha('#FFF', 0.08) }} />;
          if (item.type === 'header') {
            return !isCollapsed && (
              <Typography key={index} variant="caption" sx={{ px: 1.5, py: 1, display: 'block', color: alpha('#FFF', 0.3), fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
                {item.text}
              </Typography>
            );
          }
          
          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.text || index} disablePadding sx={{ mb: 0.25 }}>
              <Tooltip title={isCollapsed ? item.text : ""} placement="right">
                <ListItemButton 
                  onClick={() => navigate(item.path)}
                  selected={isActive}
                  sx={{
                    borderRadius: '8px',
                    py: 1,
                    px: isCollapsed ? 0 : 1.5,
                    minHeight: 40,
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'white' }
                    },
                    '&:hover': {
                      bgcolor: alpha('#FFF', 0.05),
                      '& .MuiListItemIcon-root': { color: 'white' }
                    }
                  }}
                >
                  <ListItemIcon sx={{ 
                    color: isActive ? 'white' : alpha('#FFF', 0.5),
                    minWidth: isCollapsed ? 0 : 32,
                    justifyContent: 'center',
                  }}>
                    {React.cloneElement(item.icon, { sx: { fontSize: '1.1rem' } })}
                  </ListItemIcon>
                  {!isCollapsed && (
                    <ListItemText 
                      primary={item.text} 
                      primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: isActive ? 700 : 500 }} 
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* User Footer */}
      <Box sx={{ p: 1.5, borderTop: `1px solid ${alpha('#FFF', 0.08)}` }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          p: 1, 
          borderRadius: '10px',
          bgcolor: alpha('#FFF', 0.04),
          mb: 1.5,
          justifyContent: isCollapsed ? 'center' : 'flex-start'
        }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontWeight: 800, fontSize: '0.8rem' }}>
            {authData?.name?.charAt(0) || 'U'}
          </Avatar>
          {!isCollapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ color: 'white', fontWeight: 700 }}>{authData?.name || 'User'}</Typography>
              <Typography variant="caption" sx={{ color: alpha('#FFF', 0.4), display: 'block', fontSize: '0.7rem' }}>
                {authData?.role || 'Staff'}
              </Typography>
            </Box>
          )}
        </Box>
        <Button 
          fullWidth
          variant="contained"
          color="secondary"
          size="small"
          onClick={handleLogout}
          startIcon={<LogoutIcon sx={{ fontSize: '1rem' }} />}
          sx={{ 
            borderRadius: '8px', 
            height: 36,
            justifyContent: isCollapsed ? 'center' : 'center',
            '& .MuiButton-startIcon': { margin: isCollapsed ? 0 : 'inherit' }
          }}
        >
          {!isCollapsed && "Logout"}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 }, transition: 'width 0.2s' }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280, border: 'none' },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, border: 'none', transition: 'width 0.2s' },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
});

export default Sidebar;
