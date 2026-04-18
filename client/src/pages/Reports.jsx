import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, Chip, Container, Divider,
  FormControl, Grid, InputLabel, MenuItem, Paper, Select, Stack, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField,
  Typography, alpha, useTheme,
} from '@mui/material';
import { ReportSkeleton } from '../components/SkeletonLoaders';
import moment from 'moment';
import RefreshIcon from '@mui/icons-material/Refresh';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import {
  getRevenueDetailReport, getProfitAndLoss, getBalanceSheet, getTrialBalance,
  getStudentStatement, getTeacherStatement, getReceivablesAgingReport,
  getPayablesAgingReport, getTeacherExpensesDetailReport, getCashFlowStatement,
} from '../redux/reportSlice';
import { getStudents } from '../redux/studentSlice';
import { getTeachers } from '../redux/teacherSlice';
import { formatCurrency } from '../utils/currencyUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

const SummaryRow = ({ label, amount, bold, indent, color, borderTop }) => (
  <TableRow sx={borderTop ? { borderTop: '2px solid #e0e0e0' } : {}}>
    <TableCell sx={{ pl: indent ? 5 : 2, fontWeight: bold ? 800 : 400, color: color || 'text.primary', py: 0.8 }}>
      {label}
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: bold ? 800 : 400, color: color || 'text.primary', py: 0.8 }}>
      {fmt(amount)}
    </TableCell>
  </TableRow>
);

const EmptyState = ({ msg = 'No data. Run the report.' }) => (
  <Box sx={{ py: 8, textAlign: 'center' }}>
    <AssessmentIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
    <Typography color="text.secondary">{msg}</Typography>
  </Box>
);

const PrintHeader = ({ company, title, period }) => (
  <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 3, textAlign: 'center' } }}>
    <Typography variant="h5" fontWeight={800}>{company}</Typography>
    <Typography variant="h6" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
    {period && <Typography variant="body2" color="text.secondary">{period}</Typography>}
    <Divider sx={{ my: 1 }} />
    <Typography variant="caption">Generated: {moment().format('DD MMM YYYY HH:mm')}</Typography>
  </Box>
);

// ─── Component ────────────────────────────────────────────────────────────────
const Reports = () => {
  const { companyId } = useParams();
  const dispatch = useDispatch();
  const theme = useTheme();

  const { selectedCompany } = useSelector((s) => s.companies);
  const {
    revenueDetailReport, profitAndLoss, balanceSheet, trialBalance,
    studentStatement, studentStatementSummary,
    teacherStatement, teacherStatementSummary,
    teacherExpensesDetailReport, cashFlowStatement,
    receivablesAgingReport, payablesAgingReport, loading, reportError,
  } = useSelector((s) => s.reports);
  const { students = [] } = useSelector((s) => s.students || {});
  const { teachers = [] } = useSelector((s) => s.teachers || {});

  const cid = companyId || selectedCompany?._id;

  const [tab, setTab] = useState(0);
  const [dr, setDr] = useState({
    start: moment().startOf('year').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD'),
  });
  const [selStudent, setSelStudent] = useState(null);
  const [selTeacher, setSelTeacher] = useState(null);

  // ISO helpers
  const isoStart = dr.start ? new Date(dr.start).toISOString() : undefined;
  const isoEnd   = dr.end   ? new Date(dr.end + 'T23:59:59').toISOString() : undefined;
  const periodLabel = `${moment(dr.start).format('DD MMM YYYY')} – ${moment(dr.end).format('DD MMM YYYY')}`;

  useEffect(() => {
    if (!cid) return;
    dispatch(getStudents({ companyId: cid, page: 1, limit: 2000, search: '' }));
    dispatch(getTeachers({ companyId: cid }));
  }, [cid, dispatch]);

  const runReport = useCallback(() => {
    if (!cid) return;
    const base = { companyId: cid, startDate: isoStart, endDate: isoEnd };
    switch (tab) {
      case 0: dispatch(getRevenueDetailReport({ ...base, studentId: selStudent?._id })); break;
      case 1: dispatch(getTeacherExpensesDetailReport({ ...base, teacherId: selTeacher?._id })); break;
      case 2: dispatch(getProfitAndLoss(base)); break;
      case 3: dispatch(getBalanceSheet({ companyId: cid, asOfDate: isoEnd })); break;
      case 4: dispatch(getTrialBalance(base)); break;
      case 5:
        if (selStudent) dispatch(getStudentStatement({ ...base, studentId: selStudent._id }));
        break;
      case 6:
        if (selTeacher) dispatch(getTeacherStatement({ ...base, teacherId: selTeacher._id }));
        break;
      case 7: dispatch(getReceivablesAgingReport(cid)); break;
      case 8: dispatch(getPayablesAgingReport(cid)); break;
      case 9: dispatch(getCashFlowStatement({ companyId: cid, startDate: isoStart, endDate: isoEnd })); break;
    }
  }, [cid, tab, isoStart, isoEnd, selStudent, selTeacher, dispatch]);

  // Note: Reports are NOT auto-fetched on mount — user clicks Run Report.
  // Auto-reload when tab changes only if data for that tab already exists.
  const prevTab = React.useRef(null);
  useEffect(() => {
    if (prevTab.current !== null && prevTab.current !== tab) {
      // Only auto-run tab switch if the report has data (refresh) or if
      // it's a no-param report like P&L, Balance Sheet, Trial Balance, Aging
      const autoTabs = [2, 3, 4, 7, 8, 9];
      if (autoTabs.includes(tab)) runReport();
    }
    prevTab.current = tab;
  }, [tab]); // eslint-disable-line

  if (!cid) return <Alert severity="warning" sx={{ m: 4 }}>Please select a company first.</Alert>;

  // ── CSV Download helper ──────────────────────────────────────────────────
  const downloadCSV = (rows, headers, filename) => {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { label: 'Fee Income', icon: <ReceiptIcon fontSize="small" /> },
    { label: 'Expenses / Salary', icon: <TrendingDownIcon fontSize="small" /> },
    { label: 'Profit & Loss', icon: <TrendingUpIcon fontSize="small" /> },
    { label: 'Balance Sheet', icon: <AccountBalanceIcon fontSize="small" /> },
    { label: 'Trial Balance', icon: <AssessmentIcon fontSize="small" /> },
    { label: 'Student Statement', icon: <SchoolIcon fontSize="small" /> },
    { label: 'Teacher Statement', icon: <PeopleIcon fontSize="small" /> },
    { label: 'Receivables Aging', icon: <TrendingUpIcon fontSize="small" /> },
    { label: 'Payables Aging', icon: <TrendingDownIcon fontSize="small" /> },
    { label: 'Cash Flow', icon: <WaterDropIcon fontSize="small" /> },
  ];

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="text.primary">Financial Reports</Typography>
          <Typography variant="body2" color="text.secondary">{selectedCompany?.name} — Full Accounting Cycle</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ '@media print': { display: 'none' } }}>
          <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={() => window.print()}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Print</Button>
          {tab === 4 && trialBalance?.data?.length > 0 && (
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => {
              downloadCSV(trialBalance.data.map(r => [r.accountName, r.accountType, r.debitTotal, r.creditTotal, r.debitBalance, r.creditBalance]),
                ['Account','Type','Total Dr','Total Cr','Dr Balance','Cr Balance'], `trial-balance-${dr.end}.csv`);
            }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>CSV</Button>
          )}
          {tab === 0 && revenueDetailReport && Object.keys(revenueDetailReport).length > 0 && (
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => {
              const rows = Object.values(revenueDetailReport).flatMap(g => g.items.map(i => [g.studentName, i.type, moment(i.date).format('DD MMM YYYY'), i.num, i.item, i.qty, i.price, i.amount]));
              downloadCSV(rows, ['Student','Type','Date','Receipt#','Description','Qty','Rate','Amount'], `fee-income-${dr.end}.csv`);
            }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>CSV</Button>
          )}
          <Button variant="contained" color="primary" size="small" startIcon={<RefreshIcon />}
            onClick={runReport} disabled={loading}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, boxShadow: 'none' }}>
            {loading ? 'Loading…' : 'Run Report'}
          </Button>
        </Stack>
      </Box>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, '@media print': { display: 'none' } }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField label="From" type="date" size="small" fullWidth value={dr.start}
              onChange={(e) => setDr((p) => ({ ...p, start: e.target.value }))} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField label="To" type="date" size="small" fullWidth value={dr.end}
              onChange={(e) => setDr((p) => ({ ...p, end: e.target.value }))} InputLabelProps={{ shrink: true }} />
          </Grid>
          {(tab === 0 || tab === 5) && (
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete size="small" options={students} getOptionLabel={(o) => o.name}
                value={selStudent} onChange={(_, v) => setSelStudent(v)}
                renderInput={(params) => <TextField {...params} label="Student (optional)" />} />
            </Grid>
          )}
          {(tab === 1 || tab === 6) && (
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete size="small" options={teachers} getOptionLabel={(o) => o.name}
                value={selTeacher} onChange={(_, v) => setSelTeacher(v)}
                renderInput={(params) => <TextField {...params} label="Teacher (optional)" />} />
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, '@media print': { display: 'none' } }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 52, fontSize: '0.85rem' } }}>
            {TABS.map((t, i) => (
              <Tab key={i} label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>{t.icon}{t.label}</Box>
              } />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {loading && <ReportSkeleton />}
          {!loading && reportError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}
              action={<Button size="small" onClick={runReport}>Retry</Button>}>
              {reportError}
            </Alert>
          )}

          {/* ── TAB 0: Fee Income Detail ──────────────────────────────────── */}
          {!loading && tab === 0 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Fee Income Detail" period={periodLabel} />
              {!revenueDetailReport || Object.keys(revenueDetailReport).length === 0 ? (
                <EmptyState msg="No fee income data found for the selected period." />
              ) : (
                <>
                  {Object.values(revenueDetailReport).map((grp, i) => (
                    <Box key={i} sx={{ mb: 4 }}>
                      <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.07), px: 2, py: 1, borderRadius: 1, mb: 1 }}>
                        <Typography fontWeight={700} color="primary.main">{grp.studentName}</Typography>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
                              {['Date','Receipt #','Description','Qty','Rate','Amount'].map((h) => (
                                <TableCell key={h} sx={{ fontWeight: 700 }} align={['Qty','Rate','Amount'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {grp.items.map((row) => (
                              <TableRow key={row._id} hover>
                                <TableCell>{moment(row.date).format('DD MMM YYYY')}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{row.num}</TableCell>
                                <TableCell>{row.item}</TableCell>
                                <TableCell align="right">{row.qty}</TableCell>
                                <TableCell align="right">{fmt(row.price)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(row.amount)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                              <TableCell colSpan={3} sx={{ fontWeight: 800 }}>Sub-Total — {grp.studentName}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{grp.totalQty}</TableCell>
                              <TableCell />
                              <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>{fmt(grp.totalAmount)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                  <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2, textAlign: 'right', mt: 2 }}>
                    <Typography variant="h6" fontWeight={800} color="success.dark">
                      Grand Total: {fmt(Object.values(revenueDetailReport).reduce((s, g) => s + (g.totalAmount || 0), 0))}
                    </Typography>
                  </Box>
                </>
              )}
            </>
          )}

          {/* ── TAB 1: Expenses / Teacher Salary ─────────────────────────── */}
          {!loading && tab === 1 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Expenses & Teacher Salary Detail" period={periodLabel} />
              {!teacherExpensesDetailReport || Object.keys(teacherExpensesDetailReport).length === 0 ? (
                <EmptyState msg="No expense/salary data found for the selected period." />
              ) : (
                <>
                  {Object.values(teacherExpensesDetailReport).map((grp, i) => (
                    <Box key={i} sx={{ mb: 4 }}>
                      <Box sx={{ bgcolor: alpha(theme.palette.warning.main, 0.09), px: 2, py: 1, borderRadius: 1, mb: 1 }}>
                        <Typography fontWeight={700} color="warning.dark">{grp.teacherName}</Typography>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
                              {['Date','Invoice #','Description','Qty','Rate','Amount'].map((h) => (
                                <TableCell key={h} sx={{ fontWeight: 700 }} align={['Qty','Rate','Amount'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {grp.items.map((row) => (
                              <TableRow key={row._id} hover>
                                <TableCell>{moment(row.date).format('DD MMM YYYY')}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{row.num}</TableCell>
                                <TableCell>{row.item}</TableCell>
                                <TableCell align="right">{row.qty}</TableCell>
                                <TableCell align="right">{fmt(row.price)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(row.amount)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.06) }}>
                              <TableCell colSpan={3} sx={{ fontWeight: 800 }}>Sub-Total — {grp.teacherName}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{grp.totalQty}</TableCell>
                              <TableCell />
                              <TableCell align="right" sx={{ fontWeight: 800, color: 'warning.dark' }}>{fmt(grp.totalAmount)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                  <Box sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.07), borderRadius: 2, textAlign: 'right', mt: 2 }}>
                    <Typography variant="h6" fontWeight={800} color="error.dark">
                      Total Expenses: {fmt(Object.values(teacherExpensesDetailReport).reduce((s, g) => s + (g.totalAmount || 0), 0))}
                    </Typography>
                  </Box>
                </>
              )}
            </>
          )}

          {/* ── TAB 2: Profit & Loss ─────────────────────────────────────── */}
          {!loading && tab === 2 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Income Statement (Profit & Loss)" period={periodLabel} />
              {!profitAndLoss ? <EmptyState /> : (
                <Box sx={{ maxWidth: 680, mx: 'auto' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2, textAlign: 'center' }}>
                    Income Statement — {periodLabel}
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                    <Table size="small">
                      <TableBody>
                        {/* INCOME */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.08) }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'success.dark', py: 1.5, fontSize: '0.95rem' }}>INCOME</TableCell>
                        </TableRow>
                        <SummaryRow label="Fee Revenue" amount={profitAndLoss.feeRevenue || 0} indent />
                        {(profitAndLoss.otherIncomeLines || []).map((item, i) => (
                          <SummaryRow key={i} label={item.name} amount={item.amount} indent />
                        ))}
                        <SummaryRow label="Total Income" amount={profitAndLoss.totalRevenue || profitAndLoss.grossProfit || 0} bold borderTop />

                        {/* EXPENSES */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.06), mt: 1 }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'error.dark', py: 1.5, fontSize: '0.95rem', pt: 3 }}>EXPENSES</TableCell>
                        </TableRow>
                        {(profitAndLoss.operatingExpenses || []).map((item, i) => (
                          <SummaryRow key={i} label={item.name} amount={item.amount} indent />
                        ))}
                        <SummaryRow label="Total Expenses" amount={profitAndLoss.totalOperatingExpenses} bold borderTop />

                        {/* SUMMARY */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'primary.dark', py: 1.5, fontSize: '0.95rem', pt: 3 }}>SUMMARY</TableCell>
                        </TableRow>
                        <SummaryRow label="Gross Profit" amount={profitAndLoss.grossProfit} indent />
                        <SummaryRow label="Operating Profit" amount={profitAndLoss.operatingProfit} indent />
                        <SummaryRow
                          label="Net Profit / (Loss)"
                          amount={profitAndLoss.netIncome}
                          bold borderTop
                          color={(profitAndLoss.netIncome || 0) >= 0 ? 'success.main' : 'error.main'}
                        />
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {/* CA Margin Analysis */}
                  {profitAndLoss.grossProfit > 0 && (
                    <Box sx={{ mt: 2, p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Profitability Ratios</Typography>
                      {(() => {
                        const rev = profitAndLoss.totalRevenue || profitAndLoss.grossProfit || 1;
                        const opMargin = ((profitAndLoss.operatingProfit / rev) * 100).toFixed(1);
                        const netMargin = ((profitAndLoss.netIncome / rev) * 100).toFixed(1);
                        const expRatio = ((profitAndLoss.totalOperatingExpenses / rev) * 100).toFixed(1);
                        return (
                          <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
                            <Chip size="small" label={`Fee Revenue: ${fmt(profitAndLoss.feeRevenue || 0)}`} color="primary" variant="outlined" />
                            <Chip size="small"
                              label={`Operating Margin: ${opMargin}%`}
                              color={profitAndLoss.operatingProfit >= 0 ? 'success' : 'error'} variant="outlined" />
                            <Chip size="small"
                              label={`Net Profit Margin: ${netMargin}%`}
                              color={profitAndLoss.netIncome >= 0 ? 'success' : 'error'} variant="filled" />
                            <Chip size="small"
                              label={`Expense Ratio: ${expRatio}%`}
                              color={Number(expRatio) < 70 ? 'success' : 'warning'} variant="outlined" />
                          </Box>
                        );
                      })()}
                    </Box>
                  )}
                  {(profitAndLoss.netIncome || 0) >= 0
                    ? <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>Net Profit: <strong>{fmt(profitAndLoss.netIncome)}</strong></Alert>
                    : <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>Net Loss: <strong>{fmt(Math.abs(profitAndLoss.netIncome))}</strong></Alert>
                  }
                </Box>
              )}
            </>
          )}

          {/* ── TAB 3: Balance Sheet ─────────────────────────────────────── */}
          {!loading && tab === 3 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Balance Sheet" period={`As of ${moment(dr.end).format('DD MMM YYYY')}`} />
              {!balanceSheet ? <EmptyState /> : (
                <Box sx={{ maxWidth: 720, mx: 'auto' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2, textAlign: 'center' }}>
                    Balance Sheet — As of {moment(dr.end).format('DD MMM YYYY')}
                  </Typography>
                  {!balanceSheet.isBalanced && (
                    <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                      Balance sheet is not balanced — check journal entries for missing entries.
                    </Alert>
                  )}
                  <Grid container spacing={3}>
                    {/* LEFT: Assets */}
                    <Grid item xs={12} md={6}>
                      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'success.dark' }}>ASSETS</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(balanceSheet.assets?.items || []).map((item, i) => (
                              <SummaryRow key={i} label={item.name} amount={item.amount} indent />
                            ))}
                            <SummaryRow label="Total Assets" amount={balanceSheet.assets?.total} bold borderTop />
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                    {/* RIGHT: Liabilities + Equity */}
                    <Grid item xs={12} md={6}>
                      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'error.dark' }}>LIABILITIES</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(balanceSheet.liabilities?.items || []).map((item, i) => (
                              <SummaryRow key={i} label={item.name} amount={item.amount} indent />
                            ))}
                            <SummaryRow label="Total Liabilities" amount={balanceSheet.liabilities?.total} bold borderTop />
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'primary.dark' }}>EQUITY</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(balanceSheet.equity?.items || []).map((item, i) => (
                              <SummaryRow key={i} label={item.name} amount={item.amount} indent />
                            ))}
                            <SummaryRow label="Total Equity" amount={balanceSheet.equity?.total} bold borderTop />
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                  </Grid>
                  {/* CA Ratio Analysis */}
                  {(() => {
                    const ta = balanceSheet.assets?.total || 0;
                    const tl = balanceSheet.liabilities?.total || 0;
                    const te = balanceSheet.equity?.total || 0;
                    const deRatio = te > 0 ? (tl / te).toFixed(2) : 'N/A';
                    const assetReturn = te > 0 ? ((te / ta) * 100).toFixed(1) : 'N/A';
                    return ta > 0 ? (
                      <Box sx={{ mt: 2, p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Financial Ratios</Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
                          <Chip size="small" label={`Total Assets: ${fmt(ta)}`} color="primary" variant="outlined" />
                          <Chip size="small" label={`Total Liabilities: ${fmt(tl)}`} color={tl > te ? 'error' : 'default'} variant="outlined" />
                          <Chip size="small" label={`Equity: ${fmt(te)}`} color="success" variant="outlined" />
                          <Chip size="small" label={`Debt/Equity: ${deRatio}`}
                            color={typeof deRatio === 'number' && deRatio < 1 ? 'success' : 'warning'} variant="filled" />
                          <Chip size="small" label={`Equity %: ${assetReturn}%`}
                            color={Number(assetReturn) >= 50 ? 'success' : 'warning'} variant="outlined" />
                        </Box>
                      </Box>
                    ) : null;
                  })()}
                  <Alert severity={balanceSheet.isBalanced ? 'success' : 'error'} sx={{ mt: 2, borderRadius: 2 }}>
                    {balanceSheet.isBalanced
                      ? `✅ Balance sheet is balanced — Total Assets = ${fmt(balanceSheet.assets?.total)}`
                      : `❌ Balance sheet not balanced — Assets: ${fmt(balanceSheet.assets?.total)} | Liabilities + Equity: ${fmt((balanceSheet.liabilities?.total || 0) + (balanceSheet.equity?.total || 0))}`}
                  </Alert>
                </Box>
              )}
            </>
          )}

          {/* ── TAB 4: Trial Balance ─────────────────────────────────────── */}
          {!loading && tab === 4 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Trial Balance" period={periodLabel} />
              {!trialBalance?.data?.length ? <EmptyState /> : (
                <>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2, textAlign: 'center' }}>
                    Trial Balance — {periodLabel}
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
                          <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total Debit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total Credit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Debit Balance</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Credit Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {trialBalance.data.map((row, i) => (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{row.accountName}</TableCell>
                            <TableCell>
                              <Chip label={row.accountType} size="small" variant="outlined"
                                color={row.accountType === 'revenue' ? 'success' : row.accountType === 'expense' ? 'error' : row.accountType === 'asset' ? 'primary' : 'default'} />
                            </TableCell>
                            <TableCell align="right">{row.debitTotal > 0 ? fmt(row.debitTotal) : '—'}</TableCell>
                            <TableCell align="right">{row.creditTotal > 0 ? fmt(row.creditTotal) : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{row.debitBalance > 0 ? fmt(row.debitBalance) : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{row.creditBalance > 0 ? fmt(row.creditBalance) : '—'}</TableCell>
                          </TableRow>
                        ))}
                        {/* Totals row */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.07), borderTop: '2px solid #ccc' }}>
                          <TableCell colSpan={4} sx={{ fontWeight: 800 }}>TOTALS</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>{fmt(trialBalance.totals?.debit)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>{fmt(trialBalance.totals?.credit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Alert severity={trialBalance.isBalanced ? 'success' : 'error'} sx={{ mt: 2, borderRadius: 2 }}>
                    {trialBalance.isBalanced
                      ? '✅ Trial Balance is balanced — Debits equal Credits'
                      : `❌ Trial Balance does NOT balance — Debits: ${fmt(trialBalance.totals?.debit)} | Credits: ${fmt(trialBalance.totals?.credit)}`}
                  </Alert>
                </>
              )}
            </>
          )}

          {/* ── TAB 5: Student Statement ─────────────────────────────────── */}
          {!loading && tab === 5 && (
            <>
              <PrintHeader company={selectedCompany?.name}
                title={`Student Statement${selStudent ? ` — ${selStudent.name}` : ''}`} period={periodLabel} />
              {!selStudent ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>Select a student and click <strong>Run Report</strong>.</Alert>
              ) : !studentStatement?.length ? (
                <EmptyState msg="No transactions found for this student in the selected period." />
              ) : (
                <>
                  {studentStatementSummary && (
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      {[
                        { label: 'Opening Balance', val: studentStatementSummary.openingBalance, color: 'text.secondary' },
                        { label: 'Total Billed', val: studentStatementSummary.totalBilled, color: 'error.main' },
                        { label: 'Total Received', val: studentStatementSummary.totalReceived, color: 'success.main' },
                        { label: 'Closing Balance', val: studentStatementSummary.closingBalance, color: 'primary.main' },
                      ].map((s, i) => (
                        <Grid item xs={6} sm={3} key={i}>
                          <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                            <Typography variant="h6" fontWeight={800} color={s.color}>{fmt(s.val)}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
                          {['Date','Description','Reference','Debit (Dr)','Credit (Cr)','Balance'].map((h) => (
                            <TableCell key={h} sx={{ fontWeight: 700 }} align={['Debit (Dr)','Credit (Cr)','Balance'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {studentStatement.map((entry, i) => (
                          <TableRow key={i} hover>
                            <TableCell>{moment(entry.date).format('DD MMM YYYY')}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell>{entry.reference || '—'}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main', fontWeight: entry.debit ? 600 : 400 }}>{entry.debit > 0 ? fmt(entry.debit) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: entry.credit ? 600 : 400 }}>{entry.credit > 0 ? fmt(entry.credit) : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: (entry.runningBalance || 0) > 0 ? 'error.main' : 'success.main' }}>{fmt(entry.runningBalance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          )}

          {/* ── TAB 6: Teacher Statement ─────────────────────────────────── */}
          {!loading && tab === 6 && (
            <>
              <PrintHeader company={selectedCompany?.name}
                title={`Teacher / Salary Statement${selTeacher ? ` — ${selTeacher.name}` : ''}`} period={periodLabel} />
              {!selTeacher ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>Select a teacher and click <strong>Run Report</strong>.</Alert>
              ) : !teacherStatement?.length ? (
                <EmptyState msg="No salary/purchase entries found for this teacher in the selected period." />
              ) : (
                <>
                  {teacherStatementSummary && (
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      {[
                        { label: 'Opening Balance', val: teacherStatementSummary.openingBalance, color: 'text.secondary' },
                        { label: 'Total Bills', val: teacherStatementSummary.totalBills, color: 'error.main' },
                        { label: 'Total Paid', val: teacherStatementSummary.totalPaid, color: 'success.main' },
                        { label: 'Balance Payable', val: teacherStatementSummary.closingBalance, color: 'primary.main' },
                      ].map((s, i) => (
                        <Grid item xs={6} sm={3} key={i}>
                          <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                            <Typography variant="h6" fontWeight={800} color={s.color}>{fmt(s.val)}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
                          {['Date','Description','Reference','Invoice (Cr)','Payment (Dr)','Balance'].map((h) => (
                            <TableCell key={h} sx={{ fontWeight: 700 }} align={['Invoice (Cr)','Payment (Dr)','Balance'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {teacherStatement.map((entry, i) => (
                          <TableRow key={i} hover>
                            <TableCell>{moment(entry.date).format('DD MMM YYYY')}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell>{entry.reference || '—'}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main', fontWeight: entry.credit ? 600 : 400 }}>{entry.credit > 0 ? fmt(entry.credit) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: entry.debit ? 600 : 400 }}>{entry.debit > 0 ? fmt(entry.debit) : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: (entry.runningBalance || 0) > 0 ? 'warning.dark' : 'success.main' }}>{fmt(entry.runningBalance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          )}

          {/* ── TAB 7: Receivables Aging ─────────────────────────────────── */}
          {!loading && tab === 7 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Receivables Aging Report" period={`As of ${moment().format('DD MMM YYYY')}`} />
              {!receivablesAgingReport?.data?.length ? <EmptyState msg="No outstanding receivables found." /> : (
                <>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                    Student Receivables Aging — As of {moment().format('DD MMM YYYY')}
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
                          {['Student','Current','1–30 Days','31–60 Days','61–90 Days','90+ Days','Total Due'].map((h) => (
                            <TableCell key={h} sx={{ fontWeight: 700 }} align={h === 'Student' ? 'left' : 'right'}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {receivablesAgingReport.data.map((row, i) => (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{row.studentName}</TableCell>
                            <TableCell align="right">{row.current > 0 ? fmt(row.current) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days1_30 > 0 ? 'warning.main' : 'text.disabled' }}>{row.days1_30 > 0 ? fmt(row.days1_30) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days31_60 > 0 ? 'orange' : 'text.disabled' }}>{row.days31_60 > 0 ? fmt(row.days31_60) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days61_90 > 0 ? 'error.main' : 'text.disabled' }}>{row.days61_90 > 0 ? fmt(row.days61_90) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days90plus > 0 ? 'error.dark' : 'text.disabled', fontWeight: row.days90plus > 0 ? 700 : 400 }}>{row.days90plus > 0 ? fmt(row.days90plus) : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>{fmt(row.totalDue)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06), borderTop: '2px solid #ccc' }}>
                          <TableCell sx={{ fontWeight: 800 }}>TOTAL</TableCell>
                          {['current','days1_30','days31_60','days61_90','days90plus','totalDue'].map((key) => (
                            <TableCell key={key} align="right" sx={{ fontWeight: 800 }}>
                              {fmt(receivablesAgingReport.data.reduce((s, r) => s + (r[key] || 0), 0))}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          )}

          {/* ── TAB 8: Payables Aging ────────────────────────────────────── */}
          {!loading && tab === 8 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Payables Aging Report" period={`As of ${moment().format('DD MMM YYYY')}`} />
              {!payablesAgingReport?.data?.length ? <EmptyState msg="No outstanding payables found." /> : (
                <>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                    Vendor / Teacher Payables Aging — As of {moment().format('DD MMM YYYY')}
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
                          {['Vendor / Teacher','Current','1–30 Days','31–60 Days','61–90 Days','90+ Days','Total Due'].map((h) => (
                            <TableCell key={h} sx={{ fontWeight: 700 }} align={h === 'Vendor / Teacher' ? 'left' : 'right'}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {payablesAgingReport.data.map((row, i) => (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{row.teacherName}</TableCell>
                            <TableCell align="right">{row.current > 0 ? fmt(row.current) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days1_30 > 0 ? 'warning.main' : 'text.disabled' }}>{row.days1_30 > 0 ? fmt(row.days1_30) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days31_60 > 0 ? 'orange' : 'text.disabled' }}>{row.days31_60 > 0 ? fmt(row.days31_60) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days61_90 > 0 ? 'error.main' : 'text.disabled' }}>{row.days61_90 > 0 ? fmt(row.days61_90) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: row.days90plus > 0 ? 'error.dark' : 'text.disabled', fontWeight: row.days90plus > 0 ? 700 : 400 }}>{row.days90plus > 0 ? fmt(row.days90plus) : '—'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: 'warning.dark' }}>{fmt(row.totalDue)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.07), borderTop: '2px solid #ccc' }}>
                          <TableCell sx={{ fontWeight: 800 }}>TOTAL</TableCell>
                          {['current','days1_30','days31_60','days61_90','days90plus','totalDue'].map((key) => (
                            <TableCell key={key} align="right" sx={{ fontWeight: 800 }}>
                              {fmt(payablesAgingReport.data.reduce((s, r) => s + (r[key] || 0), 0))}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          )}

          {/* ── TAB 9: Cash Flow Statement ───────────────────────────────── */}
          {!loading && tab === 9 && (
            <>
              <PrintHeader company={selectedCompany?.name} title="Cash Flow Statement" period={periodLabel} />
              {!cashFlowStatement ? <EmptyState msg="No cash flow data. Run the report." /> : (
                <Box sx={{ maxWidth: 680, mx: 'auto' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2, textAlign: 'center' }}>
                    Cash Flow Statement — {periodLabel}
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                    <Table size="small">
                      <TableBody>
                        {/* Opening */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.grey[500], 0.07) }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, py: 1.5, fontSize: '0.9rem' }}>OPENING BALANCE</TableCell>
                        </TableRow>
                        <SummaryRow label="Opening Cash" amount={cashFlowStatement.openingCash} indent />
                        <SummaryRow label="Opening Bank" amount={cashFlowStatement.openingBank} indent />
                        <SummaryRow label="Total Opening" amount={cashFlowStatement.openingBalance} bold borderTop />

                        {/* Inflows */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.07), mt: 1 }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'success.dark', py: 1.5, fontSize: '0.9rem', pt: 3 }}>CASH INFLOWS (Receipts)</TableCell>
                        </TableRow>
                        <SummaryRow label="Cash Received" amount={cashFlowStatement.cashInflows?.cash} indent />
                        <SummaryRow label="Bank Received" amount={cashFlowStatement.cashInflows?.bank} indent />
                        <SummaryRow label="Total Inflows" amount={cashFlowStatement.cashInflows?.total} bold borderTop color="success.main" />

                        {/* Outflows */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.06), mt: 1 }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'error.dark', py: 1.5, fontSize: '0.9rem', pt: 3 }}>CASH OUTFLOWS (Payments)</TableCell>
                        </TableRow>
                        <SummaryRow label="Cash Paid" amount={cashFlowStatement.cashOutflows?.cash} indent />
                        <SummaryRow label="Bank Paid" amount={cashFlowStatement.cashOutflows?.bank} indent />
                        <SummaryRow label="Total Outflows" amount={cashFlowStatement.cashOutflows?.total} bold borderTop color="error.main" />

                        {/* Summary */}
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, color: 'primary.dark', py: 1.5, fontSize: '0.9rem', pt: 3 }}>CLOSING BALANCE</TableCell>
                        </TableRow>
                        <SummaryRow label="Net Cash Flow" amount={cashFlowStatement.netCashFlow} indent
                          color={(cashFlowStatement.netCashFlow || 0) >= 0 ? 'success.main' : 'error.main'} />
                        <SummaryRow label="Closing Cash" amount={cashFlowStatement.closingCash} indent />
                        <SummaryRow label="Closing Bank" amount={cashFlowStatement.closingBank} indent />
                        <SummaryRow
                          label="Total Closing Balance"
                          amount={cashFlowStatement.closingBalance}
                          bold borderTop
                          color={(cashFlowStatement.closingBalance || 0) >= 0 ? 'primary.main' : 'error.main'}
                        />
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {(cashFlowStatement.netCashFlow || 0) >= 0
                    ? <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>Net positive cash flow: <strong>{fmt(cashFlowStatement.netCashFlow)}</strong></Alert>
                    : <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>Net negative cash flow: <strong>{fmt(Math.abs(cashFlowStatement.netCashFlow))}</strong></Alert>
                  }
                </Box>
              )}
            </>
          )}

        </Box>
      </Paper>
    </Container>
  );
};

export default Reports;
