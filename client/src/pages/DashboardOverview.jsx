/* DashboardOverview — QuickBooks-style, Quick Actions only */
import React, { useEffect, useState } from 'react';
import { Grid, Typography, Box, Card, CardContent, alpha, Chip, CircularProgress, Tooltip } from '@mui/material';
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
import QrCodeScannerIcon   from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';

import { fetchQRDailySummary } from '../services/api';

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

// ─── Animated bar row ────────────────────────────────────────────────────────
const BarRow = ({ label, value, max, color, icon }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <Box sx={{ mb: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: QB.text }}>{label}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color }}>{value}</Typography>
            </Box>
            <Box sx={{ height: 8, bgcolor: alpha(color, 0.12), borderRadius: 4, overflow: 'hidden' }}>
                <Box sx={
                    { height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 4,
                      transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }
                } />
            </Box>
        </Box>
    );
};

// ─── Today Attendance Widget ──────────────────────────────────────────────────
const TodayAttendanceWidget = ({ companyId, onNavigate }) => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        fetchQRDailySummary(companyId)
            .then(r => { if (alive) setSummary(r.data); })
            .catch(() => {})
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [companyId]);

    const students  = summary?.students?.total  ?? 0;
    const teachers  = summary?.teachers?.total  ?? 0;
    const completed = (summary?.students?.completed ?? 0) + (summary?.teachers?.completed ?? 0);
    const total     = summary?.total ?? 0;
    const maxVal    = Math.max(total, 1);

    return (
        <Card
            onClick={onNavigate}
            elevation={0}
            sx={{
                border: `1.5px solid ${alpha(QB.green, 0.35)}`,
                borderRadius: 2.5,
                mb: 4,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                '&:hover': { borderColor: QB.green, boxShadow: `0 4px 20px ${alpha(QB.green, 0.14)}` },
            }}
        >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 36, height: 36, borderRadius: 2,
                            bgcolor: alpha(QB.green, 0.1),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: QB.green,
                        }}>
                            <QrCodeScannerIcon sx={{ fontSize: '1.2rem' }} />
                        </Box>
                        <Box>
                            <Typography fontWeight={800} sx={{ color: QB.text, lineHeight: 1, fontSize: '0.95rem' }}>
                                Today's QR Attendance
                            </Typography>
                            <Typography variant="caption" sx={{ color: QB.sub }}>
                                {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {!loading && (
                            <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: '0.8rem !important' }} />}
                                label={`${total} Total`}
                                size="small"
                                sx={{ bgcolor: alpha(QB.green, 0.1), color: QB.green, fontWeight: 800, fontSize: '0.72rem' }}
                            />
                        )}
                        {loading && <CircularProgress size={18} sx={{ color: QB.green }} />}
                    </Box>
                </Box>

                {!loading && (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={8}>
                            <BarRow label="Students" value={students}  max={maxVal} color={QB.blue}   icon={<SchoolIcon sx={{ fontSize: '0.9rem' }} />} />
                            <BarRow label="Teachers" value={teachers}  max={maxVal} color={QB.purple} icon={<PeopleIcon sx={{ fontSize: '0.9rem' }} />} />
                            <BarRow label="Completed (in+out)" value={completed} max={maxVal} color={QB.green}  icon={<CheckCircleIcon sx={{ fontSize: '0.9rem' }} />} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Box sx={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                height: '100%', gap: 0.5,
                            }}>
                                <Typography sx={{ fontSize: '2.8rem', fontWeight: 900, color: QB.green, lineHeight: 1 }}>
                                    {total}
                                </Typography>
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: QB.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Scans Today
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                    <Chip label={`${students} Stu`} size="small"
                                        sx={{ bgcolor: alpha(QB.blue, 0.1), color: QB.blue, fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
                                    <Chip label={`${teachers} Tch`} size="small"
                                        sx={{ bgcolor: alpha(QB.purple, 0.1), color: QB.purple, fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                )}

                {!loading && total === 0 && (
                    <Typography sx={{ fontSize: '0.8rem', color: QB.sub, textAlign: 'center', py: 1 }}>
                        No QR scans yet today — start scanning!
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
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
    const showQR        = userRole === 'teacher' || isAdmin;

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
        ...((userRole === 'teacher' || isAdmin) ? [
            {
                icon: <EventAvailableIcon />, iconColor: QB.purple,
                label: 'Mark Attendance', desc: "Manual batch attendance",
                path: 'attendance',
            },
            {
                icon: <QrCodeScannerIcon />, iconColor: QB.green,
                label: 'QR Attendance', desc: "Webcam QR card scanner",
                path: 'qr-attendance',
            },
        ] : []),
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
            {/* ── Today's QR Attendance graph ────────────────────────────── */}
            {showQR && (
                <TodayAttendanceWidget
                    companyId={companyId}
                    onNavigate={() => navigate(`/company/${companyId}/qr-attendance`)}
                />
            )}

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
