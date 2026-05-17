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
import LayersIcon from '@mui/icons-material/Layers';

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
        { text: 'Groups', icon: <LayersIcon />, path: `/company/${companyId}/groups`, roles: ['superadmin', 'admin'] },
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

  // ── QB sidebar tokens ──────────────────────────────────────────────────────
  const SB = {
    bg:         '#1C2B36',
    activeBg:   'rgba(44,160,28,0.13)',
    activeBar:  '#2CA01C',
    activeText: '#6EDA60',
    hoverBg:    'rgba(255,255,255,0.05)',
    text:       'rgba(255,255,255,0.78)',
    muted:      'rgba(255,255,255,0.32)',
    divider:    'rgba(255,255,255,0.07)',
  };

  const drawerContent = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: SB.bg,
      color: '#FFF',
      width: drawerWidth,
      overflowX: 'hidden',
      transition: 'width 0.2s ease',
    }}>

      {/* ── Brand Header ─────────────────────────────────────────────── */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        minHeight: 56,
        borderBottom: `1px solid ${SB.divider}`,
      }}>
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{
              width: 34, height: 34,
              borderRadius: '10px',
              bgcolor: '#2CA01C',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(44,160,28,0.4)',
              flexShrink: 0,
            }}>
              <SchoolIcon sx={{ color: '#fff', fontSize: '1.15rem' }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                TLC
              </Typography>
              <Typography sx={{ color: SB.muted, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                ERP Suite
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton
          size="small"
          onClick={() => setIsCollapsed(!isCollapsed)}
          sx={{ color: SB.muted, '&:hover': { color: '#fff', bgcolor: SB.hoverBg }, borderRadius: '8px' }}
        >
          {isCollapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <List sx={{ px: 1, pt: 1.5, pb: 1, flexGrow: 1, overflowY: 'auto',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: SB.divider, borderRadius: 4 },
      }}>
        {menuItems.map((item, index) => {
          if (item.type === 'divider') {
            return <Box key={index} sx={{ my: 1, mx: 1, height: '1px', bgcolor: SB.divider }} />;
          }
          if (item.type === 'header') {
            return !isCollapsed ? (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 0.5, pb: 0.75 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#2CA01C', flexShrink: 0 }} />
                <Typography sx={{ color: SB.muted, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {item.text}
                </Typography>
              </Box>
            ) : (
              <Box key={index} sx={{ my: 0.5, mx: 'auto', width: 20, height: '1px', bgcolor: SB.divider }} />
            );
          }

          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.text || index} disablePadding sx={{ mb: 0.25 }}>
              <Tooltip title={isCollapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: '8px',
                    py: 0.9,
                    px: isCollapsed ? 0 : 1.25,
                    minHeight: 38,
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    position: 'relative',
                    bgcolor: isActive ? SB.activeBg : 'transparent',
                    borderLeft: isActive ? `3px solid ${SB.activeBar}` : '3px solid transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: isActive ? SB.activeBg : SB.hoverBg,
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    color: isActive ? SB.activeText : SB.text,
                    minWidth: isCollapsed ? 0 : 30,
                    justifyContent: 'center',
                    transition: 'color 0.15s',
                  }}>
                    {React.cloneElement(item.icon, { sx: { fontSize: '1.05rem' } })}
                  </ListItemIcon>
                  {!isCollapsed && (
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#fff' : SB.text,
                        letterSpacing: '0.01em',
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* ── User Footer ──────────────────────────────────────────────── */}
      <Box sx={{ p: 1.25, borderTop: `1px solid ${SB.divider}` }}>
        {/* Profile row */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1, py: 0.75,
          borderRadius: '10px',
          bgcolor: 'rgba(255,255,255,0.04)',
          mb: 1,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
        }}>
          <Avatar sx={{
            width: 30, height: 30,
            bgcolor: '#2CA01C',
            fontSize: '0.78rem', fontWeight: 800,
            flexShrink: 0,
          }}>
            {authData?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          {!isCollapsed && (
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2 }}>
                {authData?.name || 'User'}
              </Typography>
              <Typography sx={{ color: SB.muted, fontSize: '0.67rem', textTransform: 'capitalize', lineHeight: 1.3 }}>
                {authData?.role || 'Staff'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Logout button */}
        <Tooltip title={isCollapsed ? 'Logout' : ''} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: '8px',
              py: 0.85,
              px: isCollapsed ? 0 : 1.25,
              justifyContent: 'center',
              gap: 1,
              bgcolor: 'rgba(217,45,32,0.08)',
              border: '1px solid rgba(217,45,32,0.18)',
              '&:hover': { bgcolor: 'rgba(217,45,32,0.16)' },
              transition: 'background 0.15s',
            }}
          >
            <LogoutIcon sx={{ color: '#F87171', fontSize: '0.95rem' }} />
            {!isCollapsed && (
              <Typography sx={{ color: '#F87171', fontSize: '0.8rem', fontWeight: 700 }}>
                Logout
              </Typography>
            )}
          </ListItemButton>
        </Tooltip>
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
