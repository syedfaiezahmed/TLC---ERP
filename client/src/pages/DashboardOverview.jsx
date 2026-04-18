import React, { useEffect, useState, useMemo } from 'react';
import {
    Grid, Typography, Box, Card, CardContent, CircularProgress,
    Button, alpha, IconButton, Stack, LinearProgress, Tooltip,
    Menu, MenuItem, Chip, Divider
} from '@mui/material';
import {
    BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchDashboardSummary, fetchDashboardChartData } from '../redux/reportSlice';

import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DownloadIcon from '@mui/icons-material/Download';
import GroupsIcon from '@mui/icons-material/Groups';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import ReceiptIcon from '@mui/icons-material/Receipt';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AssessmentIcon from '@mui/icons-material/Assessment';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SchoolIcon from '@mui/icons-material/School';

// ─── Brand Palette ───────────────────────────────────────────────────────────
const B = {
    primary:  '#6C63FF',
    green:    '#4CAF50',
    red:      '#FF6B6B',
    orange:   '#FFA726',
    blue:     '#42A5F5',
    teal:     '#26C6DA',
    bg:       '#F5F6FA',
    card:     '#FFFFFF',
    border:   '#E8EAF0',
    text:     '#2D3748',
    sub:      '#718096',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtShort = (v) => {
    if (!v && v !== 0) return 'PKR 0';
    const abs = Math.abs(v);
    if (abs >= 1000000) return `PKR ${(v / 1000000).toFixed(1)}M`;
    if (abs >= 1000)    return `PKR ${(v / 1000).toFixed(0)}K`;
    return `PKR ${v.toLocaleString('en-PK')}`;
};

const fmtFull = (v) => {
    if (!v && v !== 0) return 'PKR 0';
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
};

// ─── KPI Card (enhanced with left accent border) ─────────────────────────────
const KPICard = ({ title, value, icon, trend, trendUp, subtitle, iconColor = B.primary }) => (
    <Card sx={{
        borderRadius: 2.5,
        border: `1px solid ${B.border}`,
        borderLeft: `4px solid ${iconColor}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
        '&:hover': { boxShadow: `0 8px 24px ${alpha(iconColor, 0.18)}`, transform: 'translateY(-3px)' }
    }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                <Typography variant="caption" sx={{ color: B.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, fontSize: '0.68rem' }}>
                    {title}
                </Typography>
                <Box sx={{ bgcolor: alpha(iconColor, 0.1), borderRadius: 2, p: 0.9, display: 'flex', color: iconColor }}>
                    {icon}
                </Box>
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ color: B.text, mb: 1, letterSpacing: -0.5, lineHeight: 1.1 }}>
                {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pt: 1, borderTop: `1px solid ${B.border}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, bgcolor: alpha(trendUp ? B.green : B.red, 0.1), borderRadius: 1, px: 0.75, py: 0.25 }}>
                    {trendUp
                        ? <TrendingUpIcon sx={{ fontSize: '0.75rem', color: B.green }} />
                        : <TrendingDownIcon sx={{ fontSize: '0.75rem', color: B.red }} />}
                    <Typography variant="caption" sx={{ color: trendUp ? B.green : B.red, fontWeight: 800, fontSize: '0.7rem' }}>
                        {trend}
                    </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: B.sub, fontSize: '0.72rem' }}>{subtitle}</Typography>
            </Box>
        </CardContent>
    </Card>
);

// ─── Custom Bar Tooltip ───────────────────────────────────────────────────────
const BarTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <Box sx={{ bgcolor: 'white', border: `1px solid ${B.border}`, borderRadius: 2, p: 1.75, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <Typography variant="caption" sx={{ color: B.sub, fontWeight: 700, display: 'block', mb: 0.75 }}>{label}</Typography>
            {payload.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, mb: 0.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
                        <Typography variant="caption" sx={{ color: B.sub }}>{p.name}</Typography>
                    </Box>
                    <Typography variant="caption" fontWeight={700} sx={{ color: B.text }}>{fmtFull(p.value)}</Typography>
                </Box>
            ))}
        </Box>
    );
};

const DashboardOverview = () => {
    const { companyId } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const authData = useSelector((state) => state.auth.authData);
    const { summary, chartData, loading } = useSelector((state) => state.reports);
    const { selectedCompany } = useSelector((s) => s.companies || {});
    const userRole = authData?.role || 'user';
    const isAdmin = ['superadmin', 'admin'].includes(userRole);
    const isAccountant = ['superadmin', 'admin', 'accountant'].includes(userRole);
    const [refreshing, setRefreshing] = useState(false);
    const [chartType, setChartType] = useState('bar');  // 'bar' | 'area'

    useEffect(() => {
        if (companyId) {
            dispatch(fetchDashboardSummary(companyId));
            dispatch(fetchDashboardChartData(companyId));
        }
    }, [dispatch, companyId]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([dispatch(fetchDashboardSummary(companyId)), dispatch(fetchDashboardChartData(companyId))]);
        setTimeout(() => setRefreshing(false), 600);
    };

    // ── Greeting ─────────────────────────────────────────────────────────────
    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    const userName = authData?.name || authData?.email?.split('@')[0] || 'Admin';

    // ── KPI cards ────────────────────────────────────────────────────────────
    const kpiCards = useMemo(() => {
        const cards = [];
        if (userRole !== 'student') {
            cards.push(
                { title: 'Total Students',  value: (summary?.totalStudents || 0).toLocaleString('en-PK'), icon: <GroupsIcon fontSize="small" />, trend: '+12%',  trendUp: true,  subtitle: 'vs last month',  iconColor: B.primary },
                { title: 'Active Courses',  value: (summary?.totalCourses  || 0).toLocaleString('en-PK'), icon: <AssignmentIcon fontSize="small" />,    trend: '+3 new', trendUp: true,  subtitle: 'programs',        iconColor: B.blue }
            );
        }
        if (isAccountant || isAdmin) {
            cards.push(
                { title: 'Total Revenue',   value: fmtShort(summary?.totalRevenue   || 0), icon: <MonetizationOnIcon fontSize="small" />,      trend: '+8.4%', trendUp: true,  subtitle: 'this month',      iconColor: B.green   },
                { title: 'Receivables',     value: fmtShort(summary?.totalReceivables || 0), icon: <AccountBalanceIcon fontSize="small" />,    trend: '-2.1%', trendUp: false, subtitle: 'outstanding',     iconColor: B.red     },
                { title: 'Cash & Bank',     value: fmtShort((summary?.bankBalance || 0) + (summary?.cashBalance || 0)), icon: <AccountBalanceWalletIcon fontSize="small" />, trend: '+5.2%', trendUp: true, subtitle: 'liquidity', iconColor: B.orange },
                { title: 'Net Income',      value: fmtShort(summary?.netIncome      || 0), icon: <AssessmentIcon fontSize="small" />,          trend: (summary?.netIncome || 0) >= 0 ? '+15%' : '-8%', trendUp: (summary?.netIncome || 0) >= 0, subtitle: 'profit / loss', iconColor: B.teal }
            );
        }
        return cards;
    }, [summary, userRole, isAdmin, isAccountant]);

    const barData = useMemo(() => chartData.map(d => ({
        name: d.monthName || '',
        'Fee Collection': d.totalRevenue  || 0,
        'Expenses':       d.totalExpenses || 0,
    })), [chartData]);

    const pieData = useMemo(() => [
        { name: 'Fee Revenue',  value: summary?.feeRevenue       || 0, color: B.primary },
        { name: 'Other Income', value: summary?.totalOtherIncome || 0, color: B.green   },
        { name: 'Payroll',      value: summary?.totalPayroll     || 0, color: B.orange  },
        { name: 'Expenses',     value: summary?.totalExpenses    || 0, color: B.red     },
    ].filter(d => d.value > 0), [summary]);

    const totalPie = pieData.reduce((s, d) => s + d.value, 0);
    const efficiency = (((summary?.totalRevenue || 0) / Math.max((summary?.totalRevenue || 0) + (summary?.totalReceivables || 0), 1)) * 100).toFixed(1);
    const hasOverdue = (summary?.totalReceivables || 0) > 0;

    if (loading) {
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" gap={2}>
                <CircularProgress size={44} thickness={4} sx={{ color: B.primary }} />
                <Typography variant="body2" sx={{ color: B.sub }}>Loading dashboard...</Typography>
            </Box>
        );
    }

    // ── Action row ───────────────────────────────────────────────────────────
    const ActionRow = ({ icon, iconColor, label, desc, onClick, badge }) => (
        <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 1.75, p: 1.75, borderRadius: 2.5, border: `1px solid ${B.border}`, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(.4,0,.2,1)', '&:hover': { bgcolor: alpha(iconColor, 0.04), borderColor: iconColor, transform: 'translateX(2px)' } }}>
            <Box sx={{ bgcolor: alpha(iconColor, 0.1), borderRadius: 2, p: 0.9, display: 'flex', color: iconColor, flexShrink: 0 }}>{icon}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: B.text }}>{label}</Typography>
                <Typography variant="caption" sx={{ color: B.sub }}>{desc}</Typography>
            </Box>
            {badge && <Chip label={badge} size="small" sx={{ bgcolor: alpha(B.red, 0.1), color: B.red, fontWeight: 700, height: 20, fontSize: '0.68rem' }} />}
            <ArrowForwardIcon fontSize="small" sx={{ color: B.sub, flexShrink: 0, fontSize: '1rem' }} />
        </Box>
    );

    // ── Chart Y-axis formatter ────────────────────────────────────────────────
    const yFmt = v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v;

    return (
        <Box sx={{ pb: 5 }}>

            {/* ── Welcome Banner ─────────────────────────────────────────────── */}
            <Box sx={{
                mb: 3.5, p: 3, borderRadius: 3,
                background: `linear-gradient(135deg, ${B.primary} 0%, #42A5F5 100%)`,
                position: 'relative', overflow: 'hidden',
                boxShadow: `0 8px 32px ${alpha(B.primary, 0.35)}`
            }}>
                {/* Decorative circles */}
                <Box sx={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
                <Box sx={{ position: 'absolute', right: 60, bottom: -40, width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, position: 'relative' }}>
                    {/* Left: greeting */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <SchoolIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem' }} />
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                {selectedCompany?.name || 'TLC ERP Suite'}
                            </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: 'white', mb: 0.25, letterSpacing: -0.5 }}>
                            {greeting}, {userName}! 👋
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarTodayIcon sx={{ fontSize: '0.85rem' }} />
                            {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </Typography>
                    </Box>

                    {/* Right: quick snapshot chips + action buttons */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={refreshing}
                                sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'rgba(255,255,255,0.4)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: 'white' }, fontSize: '0.8rem' }}>
                                {refreshing ? 'Refreshing...' : 'Refresh'}
                            </Button>
                            {isAccountant && (
                                <Button size="small" variant="contained" startIcon={<DownloadIcon />}
                                    sx={{ borderRadius: 2, fontWeight: 700, bgcolor: 'white', color: B.primary, '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '0.8rem' }}>
                                    Export
                                </Button>
                            )}
                        </Stack>
                        {/* Snapshot stats */}
                        <Stack direction="row" spacing={1}>
                            {[
                                { label: `${summary?.totalStudents || 0} Students`, color: 'rgba(255,255,255,0.2)' },
                                { label: `${summary?.totalCourses || 0} Courses`,   color: 'rgba(255,255,255,0.2)' },
                                { label: `${efficiency}% Efficiency`,               color: parseFloat(efficiency) >= 70 ? 'rgba(76,175,80,0.35)' : 'rgba(255,107,107,0.35)' },
                            ].map((s, i) => (
                                <Box key={i} sx={{ px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: s.color, border: '1px solid rgba(255,255,255,0.2)' }}>
                                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 700, fontSize: '0.72rem' }}>{s.label}</Typography>
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                </Box>
            </Box>

            {/* ── Overdue Alert ──────────────────────────────────────────────── */}
            {isAccountant && hasOverdue && (
                <Box sx={{ mb: 2.5, p: 1.75, borderRadius: 2.5, bgcolor: alpha(B.orange, 0.08), border: `1px solid ${alpha(B.orange, 0.25)}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <WarningAmberIcon sx={{ color: B.orange, flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: B.text }}>
                            Outstanding Receivables: {fmtShort(summary?.totalReceivables || 0)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: B.sub }}>
                            Some fee vouchers are still unpaid. Review the fee management module.
                        </Typography>
                    </Box>
                    <Button size="small" variant="outlined" onClick={() => navigate(`/company/${companyId}/fee-management`)}
                        sx={{ borderRadius: 2, fontWeight: 700, borderColor: B.orange, color: B.orange, whiteSpace: 'nowrap', '&:hover': { bgcolor: alpha(B.orange, 0.08) } }}>
                        View Fees
                    </Button>
                </Box>
            )}

            {/* ── KPI Cards ──────────────────────────────────────────────────── */}
            <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
                {kpiCards.map((card, i) => (
                    <Grid item xs={12} sm={6} md={4} lg key={i}>
                        <KPICard {...card} />
                    </Grid>
                ))}
            </Grid>

            {/* ── Chart ──────────────────────────────────────────────────────── */}
            {(isAccountant || isAdmin) && (
                <Card sx={{ borderRadius: 3, border: `1px solid ${B.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3.5 }}>
                    <CardContent sx={{ p: 3 }}>
                        {/* Chart header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
                            <Box>
                                <Typography variant="h6" fontWeight={800} sx={{ color: B.text, mb: 0.25 }}>
                                    Fee Collection & Expenses
                                </Typography>
                                <Typography variant="caption" sx={{ color: B.sub }}>Monthly financial performance — current year</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {/* Chart type toggle */}
                                <Box sx={{ display: 'flex', bgcolor: B.border, borderRadius: 2, p: 0.4 }}>
                                    {[{ type: 'bar', icon: <BarChartIcon sx={{ fontSize: '1rem' }} /> }, { type: 'area', icon: <ShowChartIcon sx={{ fontSize: '1rem' }} /> }].map(t => (
                                        <Box key={t.type} onClick={() => setChartType(t.type)}
                                            sx={{ display: 'flex', alignItems: 'center', px: 1.25, py: 0.5, borderRadius: 1.5, cursor: 'pointer', bgcolor: chartType === t.type ? 'white' : 'transparent', color: chartType === t.type ? B.primary : B.sub, boxShadow: chartType === t.type ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                                            {t.icon}
                                        </Box>
                                    ))}
                                </Box>
                                {/* Legend */}
                                {[{ color: B.primary, label: 'Fee Collection' }, { color: B.orange, label: 'Expenses' }].map(l => (
                                    <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.color }} />
                                        <Typography variant="caption" sx={{ color: B.sub, fontWeight: 600 }}>{l.label}</Typography>
                                    </Box>
                                ))}
                                <Tooltip title="View full reports">
                                    <IconButton size="small" onClick={() => navigate(`/company/${companyId}/reports`)}
                                        sx={{ bgcolor: alpha(B.primary, 0.08), '&:hover': { bgcolor: alpha(B.primary, 0.16) } }}>
                                        <ArrowForwardIcon fontSize="small" sx={{ color: B.primary }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        {/* Summary strip */}
                        <Box sx={{ display: 'flex', gap: 3, mb: 2.5, p: 2, bgcolor: alpha(B.primary, 0.03), borderRadius: 2, border: `1px solid ${alpha(B.primary, 0.08)}`, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Total Collected', value: fmtShort(barData.reduce((s, d) => s + d['Fee Collection'], 0)), color: B.primary },
                                { label: 'Total Expenses',  value: fmtShort(barData.reduce((s, d) => s + d['Expenses'], 0)),        color: B.orange },
                                { label: 'Net Surplus',     value: fmtShort(barData.reduce((s, d) => s + d['Fee Collection'] - d['Expenses'], 0)), color: B.green },
                            ].map((s, i) => (
                                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {i > 0 && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                                    <Typography variant="caption" sx={{ color: B.sub }}>{s.label}:</Typography>
                                    <Typography variant="caption" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                                </Box>
                            ))}
                        </Box>

                        <Box sx={{ height: 280 }}>
                            <ResponsiveContainer>
                                {chartType === 'bar' ? (
                                    <BarChart data={barData} barGap={4} barCategoryGap="28%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={B.border} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: B.sub, fontSize: 12, fontWeight: 600 }} dy={8} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: B.sub, fontSize: 11, fontWeight: 600 }} tickFormatter={yFmt} />
                                        <ChartTooltip content={<BarTip />} />
                                        <Bar dataKey="Fee Collection" fill={B.primary} radius={[4,4,0,0]} />
                                        <Bar dataKey="Expenses"       fill={B.orange}  radius={[4,4,0,0]} />
                                    </BarChart>
                                ) : (
                                    <AreaChart data={barData}>
                                        <defs>
                                            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={B.primary} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={B.primary} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={B.orange} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={B.orange} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={B.border} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: B.sub, fontSize: 12, fontWeight: 600 }} dy={8} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: B.sub, fontSize: 11, fontWeight: 600 }} tickFormatter={yFmt} />
                                        <ChartTooltip content={<BarTip />} />
                                        <Area type="monotone" dataKey="Fee Collection" stroke={B.primary} strokeWidth={2.5} fill="url(#gRev)" />
                                        <Area type="monotone" dataKey="Expenses"       stroke={B.orange}  strokeWidth={2.5} fill="url(#gExp)" />
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* ── Bottom Row ─────────────────────────────────────────────────── */}
            <Grid container spacing={3}>

                {/* Financial Breakdown */}
                {isAccountant && (
                    <Grid item xs={12} md={7}>
                        <Card sx={{ borderRadius: 3, border: `1px solid ${B.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                                    <Box>
                                        <Typography variant="h6" fontWeight={800} sx={{ color: B.text }}>Financial Breakdown</Typography>
                                        <Typography variant="caption" sx={{ color: B.sub }}>Distribution by category this period</Typography>
                                    </Box>
                                    <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: alpha(parseFloat(efficiency) >= 70 ? B.green : B.orange, 0.1) }}>
                                        <Typography variant="caption" fontWeight={800} sx={{ color: parseFloat(efficiency) >= 70 ? B.green : B.orange }}>
                                            {efficiency}% efficient
                                        </Typography>
                                    </Box>
                                </Box>

                                {pieData.length > 0 ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                                        <Box sx={{ width: 210, height: 210, flexShrink: 0 }}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={95} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                                                        {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                                                    </Pie>
                                                    <ChartTooltip formatter={v => fmtFull(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${B.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '0.8rem' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </Box>
                                        <Stack spacing={1.5} sx={{ flex: 1, minWidth: 160 }}>
                                            {pieData.map((item, i) => (
                                                <Box key={i}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                                                            <Typography variant="caption" fontWeight={700} sx={{ color: B.text }}>{item.name}</Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <Typography variant="caption" sx={{ color: B.sub, fontSize: '0.7rem' }}>{fmtShort(item.value)}</Typography>
                                                            <Typography variant="caption" fontWeight={800} sx={{ color: item.color, minWidth: 30, textAlign: 'right' }}>
                                                                {totalPie > 0 ? ((item.value / totalPie) * 100).toFixed(0) : 0}%
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                    <LinearProgress variant="determinate"
                                                        value={totalPie > 0 ? (item.value / totalPie) * 100 : 0}
                                                        sx={{ height: 6, borderRadius: 3, bgcolor: alpha(item.color, 0.12), '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 3 } }} />
                                                </Box>
                                            ))}
                                        </Stack>
                                    </Box>
                                ) : (
                                    <Box sx={{ py: 6, textAlign: 'center' }}>
                                        <Typography variant="body2" sx={{ color: B.sub }}>No financial data available yet</Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                {/* Quick Actions */}
                <Grid item xs={12} md={isAccountant ? 5 : 12}>
                    <Card sx={{ borderRadius: 3, border: `1px solid ${B.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight={800} sx={{ color: B.text }}>Quick Actions</Typography>
                            <Typography variant="caption" sx={{ color: B.sub }}>Frequently used shortcuts</Typography>
                            <Stack spacing={1.25} sx={{ mt: 2.5 }}>
                                {userRole !== 'student' && (
                                    <ActionRow icon={<AddIcon fontSize="small" />} iconColor={B.primary}
                                        label="Enroll Student" desc="Add new student enrollment"
                                        onClick={() => navigate(`/company/${companyId}/students`)} />
                                )}
                                {isAccountant && (
                                    <ActionRow icon={<ReceiptIcon fontSize="small" />} iconColor={B.green}
                                        label="Collect Fee" desc="Record fee payment"
                                        badge={hasOverdue ? 'Due' : null}
                                        onClick={() => navigate(`/company/${companyId}/fee-management`)} />
                                )}
                                {(userRole === 'teacher' || isAdmin) && (
                                    <ActionRow icon={<EventAvailableIcon fontSize="small" />} iconColor={B.blue}
                                        label="Mark Attendance" desc="Record today's attendance"
                                        onClick={() => navigate(`/company/${companyId}/attendance`)} />
                                )}
                                {isAdmin && (
                                    <ActionRow icon={<AssessmentIcon fontSize="small" />} iconColor={B.primary}
                                        label="Financial Reports" desc="P&L, Balance Sheet, Trial Balance"
                                        onClick={() => navigate(`/company/${companyId}/reports`)} />
                                )}
                            </Stack>

                            {/* Net income insight card */}
                            {isAccountant && (
                                <Box sx={{ mt: 2.5, p: 2, borderRadius: 2.5, bgcolor: (summary?.netIncome || 0) >= 0 ? alpha(B.green, 0.06) : alpha(B.red, 0.06), border: `1px solid ${alpha((summary?.netIncome || 0) >= 0 ? B.green : B.red, 0.2)}` }}>
                                    <Typography variant="caption" fontWeight={700} sx={{ color: B.sub, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.67rem' }}>
                                        Net Income This Period
                                    </Typography>
                                    <Typography variant="h5" fontWeight={800} sx={{ color: (summary?.netIncome || 0) >= 0 ? B.green : B.red, my: 0.5, letterSpacing: -0.5 }}>
                                        {fmtShort(summary?.netIncome || 0)}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {(summary?.netIncome || 0) >= 0
                                            ? <TrendingUpIcon sx={{ fontSize: '0.875rem', color: B.green }} />
                                            : <TrendingDownIcon sx={{ fontSize: '0.875rem', color: B.red }} />}
                                        <Typography variant="caption" sx={{ color: B.sub }}>
                                            {(summary?.netIncome || 0) >= 0 ? 'Institute is profitable this period' : 'Expenses exceed revenue — review costs'}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DashboardOverview;
