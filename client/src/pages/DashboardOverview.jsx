/* DashboardOverview — QuickBooks-style, Quick Actions only */
import React from 'react';
import { Grid, Typography, Box, Card, CardContent, alpha } from '@mui/material';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';

import PersonAddIcon       from '@mui/icons-material/PersonAdd';
import ReceiptIcon         from '@mui/icons-material/Receipt';
import EventAvailableIcon  from '@mui/icons-material/EventAvailable';
import AssessmentIcon      from '@mui/icons-material/Assessment';
import PeopleIcon          from '@mui/icons-material/People';
import PaymentsIcon        from '@mui/icons-material/Payments';
import AccountBalanceIcon  from '@mui/icons-material/AccountBalance';
import InventoryIcon       from '@mui/icons-material/Inventory';
import SchoolIcon          from '@mui/icons-material/School';
import CalendarMonthIcon   from '@mui/icons-material/CalendarMonth';
import BarChartIcon        from '@mui/icons-material/BarChart';

// ─── QuickBooks colour tokens ─────────────────────────────────────────────────
const QB = {
    green:  '#2CA01C',
    blue:   '#0077C5',
    orange: '#F97316',
    purple: '#7C3AED',
    teal:   '#0891B2',
    red:    '#D92D20',
    amber:  '#D97706',
    border: '#D0D5DD',
    text:   '#3D3D3D',
    sub:    '#6B7280',
    hover:  '#F0FBF0',
};

// ─── Action Card ─────────────────────────────────────────────────────────────
const ActionCard = ({ icon, iconColor, label, desc, onClick }) => (
    <Card
        onClick={onClick}
        sx={{
            cursor: 'pointer',
            border: `1.5px solid ${QB.border}`,
            borderRadius: 2,
            boxShadow: 'none',
            height: '100%',
            transition: 'all 0.18s ease',
            '&:hover': {
                borderColor: QB.green,
                bgcolor: QB.hover,
                boxShadow: `0 4px 18px ${alpha(QB.green, 0.15)}`,
                transform: 'translateY(-2px)',
            },
        }}
    >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{
                bgcolor: alpha(iconColor, 0.1),
                width: 46, height: 46,
                borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mb: 1.75, color: iconColor,
            }}>
                {icon}
            </Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: QB.text, mb: 0.5, lineHeight: 1.3 }}>
                {label}
            </Typography>
            <Typography variant="caption" sx={{ color: QB.sub }}>
                {desc}
            </Typography>
        </CardContent>
    </Card>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────
const DashboardOverview = () => {
    const { companyId } = useParams();
    const navigate      = useNavigate();
    const authData      = useSelector((s) => s.auth.authData);
    const userRole      = authData?.role || 'user';
    const isAdmin       = ['superadmin', 'admin'].includes(userRole);
    const isAccountant  = ['superadmin', 'admin', 'accountant'].includes(userRole);

    const actions = [
        ...(userRole !== 'student' ? [{
            icon: <PersonAddIcon />, iconColor: QB.green,
            label: 'Enroll Student', desc: 'Add a new student enrollment',
            path: 'students',
        }] : []),
        ...(isAccountant ? [
            {
                icon: <PaymentsIcon />, iconColor: QB.blue,
                label: 'Collect Fee', desc: 'Record an incoming fee payment',
                path: 'fee-management',
            },
            {
                icon: <ReceiptIcon />, iconColor: QB.teal,
                label: 'Fee Vouchers', desc: 'Generate & manage fee vouchers',
                path: 'fees',
            },
        ] : []),
        ...((userRole === 'teacher' || isAdmin) ? [{
            icon: <EventAvailableIcon />, iconColor: QB.purple,
            label: 'Mark Attendance', desc: "Record today's attendance",
            path: 'attendance',
        }] : []),
        ...(isAdmin ? [
            {
                icon: <SchoolIcon />, iconColor: QB.amber,
                label: 'Students', desc: 'Manage student records',
                path: 'students',
            },
            {
                icon: <PeopleIcon />, iconColor: QB.blue,
                label: 'Teachers & Payroll', desc: 'Manage staff & run payroll',
                path: 'teachers',
            },
            {
                icon: <AssessmentIcon />, iconColor: QB.green,
                label: 'Financial Reports', desc: 'P&L, Balance Sheet, Trial Balance',
                path: 'reports',
            },
            {
                icon: <AccountBalanceIcon />, iconColor: QB.teal,
                label: 'General Ledger', desc: 'Journal entries & account balances',
                path: 'ledger',
            },
            {
                icon: <InventoryIcon />, iconColor: QB.red,
                label: 'Expenses', desc: 'Record & track business expenses',
                path: 'expenses',
            },
            {
                icon: <CalendarMonthIcon />, iconColor: QB.purple,
                label: 'Batches & Exams', desc: 'Schedule batches and exam sessions',
                path: 'batches',
            },
            {
                icon: <BarChartIcon />, iconColor: QB.orange,
                label: 'Fee Reports', desc: 'Collection reports & student ledgers',
                path: 'fee-reports',
            },
        ] : []),
    ];

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', pt: 4, pb: 6 }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: QB.text, mb: 0.5 }}>
                What would you like to do?
            </Typography>
            <Typography variant="body2" sx={{ color: QB.sub, mb: 4 }}>
                Select an action to get started
            </Typography>

            <Grid container spacing={2.5}>
                {actions.map((a, i) => (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                        <ActionCard
                            {...a}
                            onClick={() => navigate(`/company/${companyId}/${a.path}`)}
                        />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default DashboardOverview;
