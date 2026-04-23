import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  getPayrolls, getPayrollSummary, generatePayroll, generateBulkPayroll,
  approvePayroll, payPayroll, updatePayroll, deletePayroll,
} from '../redux/payrollSlice';
import { getTeachers } from '../redux/teacherSlice';
import {
  Box, Typography, Button, Card, CardContent, Grid, Table, TableBody, TableCell,
  TableHead, TableRow, TableContainer, IconButton, Chip, CircularProgress, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, Alert, Stack,
  Tooltip, MenuItem, Select, FormControl, InputLabel, useTheme, alpha,
} from '@mui/material';
import {
  Add as AddIcon, CheckCircle as ApproveIcon, Payment as PayIcon,
  Delete as DeleteIcon, Print as PrintIcon, Refresh as RefreshIcon,
  Group as BulkIcon, Edit as EditIcon, Warning as WarningIcon,
  AccountBalance as SalaryIcon,
} from '@mui/icons-material';
import moment from 'moment';
import { toast } from 'react-toastify';
import StatCard from '../components/StatCard';

// ─── Payslip HTML Generator ───────────────────────────────────────────────────
const generatePayslipHTML = (payroll, companyName) => {
  const t = payroll.teacher || {};
  const sc = payroll.salaryComponents || {};
  const fixed = sc.fixedSalary?.amount || 0;
  const perClassTotal = sc.perClassEarnings?.totalAmount || 0;
  const commissionTotal = sc.commission?.totalAmount || 0;
  const gross = payroll.totalSalary || 0;
  const deductions = payroll.deductions || 0;
  const net = payroll.netSalary || 0;
  const monthStr = moment(payroll.month).format('MMMM YYYY');

  const perClassRows = (sc.perClassEarnings?.breakdown || []).map(b => `
    <tr>
      <td style="padding:6px 12px;">Per-Class: ${b.courseName || '—'}${b.batchName ? ` (${b.batchName})` : ''} — ${b.classCount} classes × PKR ${Number(b.ratePerClass).toLocaleString()}</td>
      <td style="padding:6px 12px;text-align:right;">PKR ${Number(b.amount).toLocaleString()}</td>
    </tr>`).join('');

  const commissionRows = (sc.commission?.breakdown || []).map(b => `
    <tr>
      <td style="padding:6px 12px;">Commission: ${b.courseName || '—'} (${b.commissionRate}% of PKR ${Number(b.feeCollected).toLocaleString()})</td>
      <td style="padding:6px 12px;text-align:right;">PKR ${Number(b.amount).toLocaleString()}</td>
    </tr>`).join('');

  const deductionRows = (payroll.deductionDetails || []).map(d => `
    <tr>
      <td style="padding:6px 12px;">${d.description || 'Deduction'}</td>
      <td style="padding:6px 12px;text-align:right;color:#000000;">PKR ${Number(d.amount).toLocaleString()}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Pay Slip - ${t.name || ''} - ${monthStr}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; background:#fff; }
    .page { width:700px; margin:30px auto; border:1px solid #ccc; border-radius:6px; overflow:hidden; }
    .header { background: linear-gradient(135deg, #000000, #333333); color:#fff; padding:16px 28px; }
    .header-inner { display:flex; align-items:center; gap:14px; }
    .header-logo { width:56px; height:56px; object-fit:contain; flex-shrink:0; border-radius:50%; background:#fff; padding:3px; }
    .header-logo-placeholder { width:56px; height:56px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:900; color:#fff; flex-shrink:0; }
    .header h1 { font-size:20px; font-weight:900; letter-spacing:0.5px; margin:0; }
    .header h2 { font-size:12px; font-weight:600; margin:2px 0 0; opacity:0.9; letter-spacing:1px; text-transform:uppercase; }
    .header p { font-size:11px; opacity:0.75; margin:3px 0 0; }
    .payslip-title { background:#f5f5f5; text-align:center; padding:10px; border-bottom:2px solid #000000; }
    .payslip-title h2 { font-size:16px; font-weight:800; color:#000000; letter-spacing:3px; }
    .payslip-title span { font-size:12px; color:#666; }
    .employee-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; border-bottom:1px solid #ddd; }
    .emp-col { padding:14px 20px; }
    .emp-col:first-child { border-right:1px solid #ddd; }
    .emp-row { margin-bottom:6px; }
    .emp-label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:0.5px; }
    .emp-value { font-size:13px; font-weight:700; color:#222; }
    table { width:100%; border-collapse:collapse; }
    .section-header { background:#000000; color:#fff; padding:8px 12px; font-size:12px; font-weight:700; letter-spacing:1px; }
    tr:nth-child(even) { background:#f9f9f9; }
    .total-row td { font-weight:800; background:#f0f0f0; font-size:13px; padding:10px 12px; border-top:2px solid #000000; }
    .deduction-total td { font-weight:800; background:#f0f0f0; font-size:13px; padding:10px 12px; border-top:2px solid #000000; }
    .net-row td { font-weight:800; background:#000000; color:#fff; font-size:15px; padding:12px; border-top:3px solid #000000; }
    .footer { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid #ddd; padding:20px; gap:20px; }
    .sig-box { border-top:1px solid #555; padding-top:6px; margin-top:30px; font-size:11px; color:#666; text-align:center; }
    .status-badge { display:inline-block; padding:3px 12px; border-radius:20px; font-size:11px; font-weight:800; }
    .status-paid { background:#f0f0f0; color:#000000; }
    .status-approved { background:#f0f0f0; color:#000000; }
    .status-draft { background:#f0f0f0; color:#000000; }
    @media print {
      body { background:#fff; }
      .page { margin:0; border:none; border-radius:0; width:100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-inner">
        <img src="/logo.png" alt="TLC Logo" class="header-logo" onerror="this.style.display='none'" />
        <div>
          <h1>THE LEARNING COLLEGIATE</h1>
          <h2>North Campus</h2>
          <p>Payroll Department &nbsp;|&nbsp; Confidential Document</p>
        </div>
      </div>
    </div>
    <div class="payslip-title">
      <h2>PAY SLIP</h2>
      <span>${monthStr} &nbsp;|&nbsp; Generated: ${moment().format('DD MMM YYYY')}</span>
    </div>
    <div class="employee-grid">
      <div class="emp-col">
        <div class="emp-row"><div class="emp-label">Employee Name</div><div class="emp-value">${t.name || '—'}</div></div>
        <div class="emp-row"><div class="emp-label">Designation</div><div class="emp-value">Teacher / Faculty</div></div>
        <div class="emp-row"><div class="emp-label">Specialization</div><div class="emp-value">${t.specialization || '—'}</div></div>
      </div>
      <div class="emp-col">
        <div class="emp-row"><div class="emp-label">Salary Type</div><div class="emp-value">${payroll.salaryType?.replace('_', ' ').toUpperCase() || '—'}</div></div>
        <div class="emp-row"><div class="emp-label">Contact</div><div class="emp-value">${t.contact || '—'}</div></div>
        <div class="emp-row"><div class="emp-label">Status</div><div class="emp-value"><span class="status-badge status-${payroll.status}">${(payroll.status || '').toUpperCase()}</span></div></div>
      </div>
    </div>
    <!-- Earnings -->
    <table>
      <tr><td colspan="2" class="section-header">EARNINGS</td></tr>
      ${fixed > 0 ? `<tr><td style="padding:6px 12px;">Basic / Fixed Salary${t.annualSalary > 0 ? ` (Annual PKR ${Number(t.annualSalary).toLocaleString()} ÷ 12)` : ''}</td><td style="padding:6px 12px;text-align:right;">PKR ${Number(fixed).toLocaleString()}</td></tr>` : ''}
      ${perClassRows}
      ${commissionRows}
      <tr class="total-row"><td>GROSS SALARY</td><td style="text-align:right;">PKR ${Number(gross).toLocaleString()}</td></tr>
    </table>
    <!-- Deductions -->
    ${deductions > 0 ? `
    <table style="margin-top:0;">
      <tr><td colspan="2" class="section-header">DEDUCTIONS</td></tr>
      ${deductionRows}
      <tr class="deduction-total"><td>TOTAL DEDUCTIONS</td><td style="text-align:right;color:#000000;">PKR ${Number(deductions).toLocaleString()}</td></tr>
    </table>` : ''}
    <!-- Net Salary -->
    <table>
      <tr class="net-row"><td>NET SALARY PAYABLE</td><td style="text-align:right;">PKR ${Number(net).toLocaleString()}</td></tr>
    </table>
    <!-- Footer -->
    <div class="footer">
      <div>
        <div class="emp-label">Payment Method</div>
        <div class="emp-value">${payroll.paymentMethod || '—'}</div>
        ${payroll.paidDate ? `<div style="font-size:11px;color:#666;">Paid: ${moment(payroll.paidDate).format('DD MMM YYYY')}</div>` : ''}
        ${payroll.paymentReference ? `<div style="font-size:11px;color:#666;">Ref: ${payroll.paymentReference}</div>` : ''}
      </div>
      <div>
        <div class="emp-label">Notes</div>
        <div style="font-size:12px;color:#444;">${payroll.notes || '—'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;padding:20px;gap:40px;border-top:1px solid #eee;">
      <div class="sig-box">Employee Signature</div>
      <div class="sig-box">Authorized Signatory</div>
    </div>
  </div>
</body>
</html>`;
};

const printPayslip = (payroll, companyName) => {
  const w = window.open('', '_blank');
  w.document.write(generatePayslipHTML(payroll, companyName));
  w.document.close();
  setTimeout(() => w.print(), 500);
};

// ─── Status Chip ──────────────────────────────────────────────────────────────
const StatusChip = ({ status }) => {
  const map = { draft: ['Draft', 'default'], approved: ['Approved', 'info'], paid: ['Paid', 'success'], cancelled: ['Cancelled', 'error'] };
  const [label, color] = map[status] || [status, 'default'];
  return <Chip size="small" label={label} color={color} sx={{ fontWeight: 700, fontSize: '0.7rem' }} />;
};

const SalaryTypeChip = ({ type }) => {
  const map = { fixed: ['Fixed', 'primary'], per_class: ['Per Class', 'success'], commission: ['Commission', 'warning'], hybrid: ['Hybrid', 'secondary'] };
  const [label, color] = map[type] || [type, 'default'];
  return <Chip size="small" label={label} color={color} variant="outlined" sx={{ fontWeight: 600, fontSize: '0.68rem' }} />;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Payroll = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { companyId } = useParams();
  const { payrolls, summary, loading, summaryLoading } = useSelector(s => s.payroll);
  const { teachers } = useSelector(s => s.teachers);
  const company = useSelector(s => s.companies.companies?.find(c => c._id === companyId));

  const [filterMonth, setFilterMonth] = useState(moment().format('YYYY-MM'));
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('');

  // Dialogs
  const [generateDlg, setGenerateDlg] = useState(false);
  const [bulkDlg, setBulkDlg] = useState(false);
  const [approveDlg, setApproveDlg] = useState(null);
  const [payDlg, setPayDlg] = useState(null);
  const [deductionDlg, setDeductionDlg] = useState(null);
  const [deleteDlg, setDeleteDlg] = useState(null);

  // Forms
  const [genForm, setGenForm] = useState({ teacherId: '', month: moment().format('YYYY-MM') });
  const [bulkMonth, setBulkMonth] = useState(moment().format('YYYY-MM'));
  const [payForm, setPayForm] = useState({ paymentMethod: 'Cash', paymentReference: '', paymentDate: moment().format('YYYY-MM-DD') });
  const [deductionForm, setDeductionForm] = useState({ deductions: 0, deductionDetails: [], notes: '' });
  const [actioning, setActioning] = useState(false);

  const loadPayrolls = useCallback(() => {
    const params = {};
    if (filterMonth) params.month = filterMonth;
    if (filterStatus !== 'all') params.status = filterStatus;
    if (filterTeacher) params.teacherId = filterTeacher;
    dispatch(getPayrolls({ companyId, params }));
    dispatch(getPayrollSummary({ companyId, month: filterMonth }));
  }, [dispatch, companyId, filterMonth, filterStatus, filterTeacher]);

  useEffect(() => {
    if (companyId) {
      loadPayrolls();
      dispatch(getTeachers({ companyId, params: {} }));
    }
  }, [companyId, loadPayrolls, dispatch]);

  const fmt = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

  // Generate Single Payroll
  const handleGenerate = async () => {
    if (!genForm.teacherId || !genForm.month) return toast.error('Select teacher and month');
    setActioning(true);
    try {
      await dispatch(generatePayroll({ companyId, teacherId: genForm.teacherId, month: genForm.month })).unwrap();
      toast.success('Payroll generated successfully');
      setGenerateDlg(false);
      loadPayrolls();
    } catch (e) { toast.error(e?.message || 'Generate failed'); }
    setActioning(false);
  };

  // Bulk Generate
  const handleBulkGenerate = async () => {
    if (!bulkMonth) return toast.error('Select month');
    setActioning(true);
    try {
      const r = await dispatch(generateBulkPayroll({ companyId, month: bulkMonth })).unwrap();
      toast.success(`Generated: ${r.generated?.length || 0} | Skipped: ${r.skipped?.length || 0}`);
      setBulkDlg(false);
      loadPayrolls();
    } catch (e) { toast.error(e?.message || 'Bulk generate failed'); }
    setActioning(false);
  };

  // Approve
  const handleApprove = async () => {
    setActioning(true);
    try {
      await dispatch(approvePayroll(approveDlg._id)).unwrap();
      toast.success('Payroll approved — journal posted: Dr Salary Expense Cr Salary Payable');
      setApproveDlg(null);
      loadPayrolls();
    } catch (e) { toast.error(e?.message || 'Approve failed'); }
    setActioning(false);
  };

  // Pay
  const handlePay = async () => {
    setActioning(true);
    try {
      await dispatch(payPayroll({ id: payDlg._id, payload: payForm })).unwrap();
      toast.success('Payment recorded — journal posted: Dr Salary Payable Cr Cash/Bank');
      setPayDlg(null);
      loadPayrolls();
    } catch (e) { toast.error(e?.message || 'Payment failed'); }
    setActioning(false);
  };

  // Save Deductions
  const handleSaveDeductions = async () => {
    setActioning(true);
    try {
      await dispatch(updatePayroll({ id: deductionDlg._id, payload: deductionForm })).unwrap();
      toast.success('Deductions updated');
      setDeductionDlg(null);
      loadPayrolls();
    } catch (e) { toast.error(e?.message || 'Update failed'); }
    setActioning(false);
  };

  // Delete
  const handleDelete = async () => {
    setActioning(true);
    try {
      await dispatch(deletePayroll(deleteDlg._id)).unwrap();
      toast.success('Payroll deleted');
      setDeleteDlg(null);
      loadPayrolls();
    } catch (e) { toast.error(e?.message || 'Delete failed'); }
    setActioning(false);
  };

  const openDeductionDlg = (p) => {
    setDeductionForm({ deductions: p.deductions || 0, deductionDetails: p.deductionDetails || [], notes: p.notes || '' });
    setDeductionDlg(p);
  };

  const addDeductionRow = () => setDeductionForm(f => ({
    ...f, deductionDetails: [...f.deductionDetails, { description: '', amount: 0 }]
  }));
  const updateDeductionRow = (i, field, val) => setDeductionForm(f => {
    const arr = [...f.deductionDetails]; arr[i] = { ...arr[i], [field]: val };
    const total = arr.reduce((s, d) => s + Number(d.amount || 0), 0);
    return { ...f, deductionDetails: arr, deductions: total };
  });
  const removeDeductionRow = (i) => setDeductionForm(f => {
    const arr = f.deductionDetails.filter((_, idx) => idx !== i);
    return { ...f, deductionDetails: arr, deductions: arr.reduce((s, d) => s + Number(d.amount || 0), 0) };
  });

  const companyName = 'THE LEARNING COLLEGIATE';

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Payroll Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Generate, approve & pay salaries — with automatic journal entries
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadPayrolls}>Refresh</Button>
          <Button variant="outlined" size="small" startIcon={<BulkIcon />} onClick={() => setBulkDlg(true)} color="secondary">
            Bulk Generate
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setGenerateDlg(true)}>
            Generate Payroll
          </Button>
        </Stack>
      </Box>

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total Payroll" value={fmt(summary?.totalNet)} icon={<SalaryIcon />} color="primary" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Draft" value={summary?.draft || 0} icon={<EditIcon />} color="warning" subtitle={fmt(summary?.pendingAmount)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Approved" value={summary?.approved || 0} icon={<ApproveIcon />} color="info" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Paid" value={summary?.paid || 0} icon={<PayIcon />} color="success" subtitle={fmt(summary?.paidAmount)} />
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <TextField label="Month" type="month" size="small" value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Teacher</InputLabel>
              <Select value={filterTeacher} label="Teacher" onChange={e => setFilterTeacher(e.target.value)}>
                <MenuItem value="">All Teachers</MenuItem>
                {(teachers || []).map(t => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Payroll Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : payrolls.length === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 8 }}>
          <SalaryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No payrolls for this period</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            Click "Generate Payroll" or "Bulk Generate" to create payrolls
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenerateDlg(true)}>Generate Payroll</Button>
        </Card>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Teacher</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Fixed</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Per-Class</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Commission</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Gross</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Deductions</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Net Salary</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payrolls.map(p => {
                  const sc = p.salaryComponents || {};
                  return (
                    <TableRow key={p._id} hover>
                      <TableCell>
                        <Typography fontWeight={700} variant="body2">{p.teacher?.name || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.teacher?.contact || ''}</Typography>
                      </TableCell>
                      <TableCell><SalaryTypeChip type={p.salaryType} /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{moment(p.month).format('MMM YYYY')}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{sc.fixedSalary?.amount > 0 ? fmt(sc.fixedSalary.amount) : '—'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {sc.perClassEarnings?.totalAmount > 0 ? (
                          <Tooltip title={(sc.perClassEarnings?.breakdown || []).map(b => `${b.courseName}${b.batchName ? ` [${b.batchName}]` : ''}: ${b.classCount} cls × ${b.ratePerClass} = ${b.amount}`).join('\n')}>
                            <Typography variant="body2" color="success.main" fontWeight={600}>
                              {fmt(sc.perClassEarnings.totalAmount)}
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                ({sc.perClassEarnings.classCount} cls)
                              </Typography>
                            </Typography>
                          </Tooltip>
                        ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        {sc.commission?.totalAmount > 0 ? (
                          <Tooltip title={(sc.commission?.breakdown || []).map(b => `${b.courseName}: ${b.commissionRate}% of ${fmt(b.feeCollected)}`).join('\n')}>
                            <Typography variant="body2" color="warning.main" fontWeight={600}>
                              {fmt(sc.commission.totalAmount)}
                            </Typography>
                          </Tooltip>
                        ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700}>{fmt(p.totalSalary)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {p.deductions > 0 ? (
                          <Typography variant="body2" color="error.main">({fmt(p.deductions)})</Typography>
                        ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={800} color="primary.main">{fmt(p.netSalary)}</Typography>
                      </TableCell>
                      <TableCell><StatusChip status={p.status} /></TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.25} justifyContent="center">
                          {p.status === 'draft' && (
                            <Tooltip title="Approve (Posts Dr Salary Exp Cr Salary Payable)">
                              <IconButton size="small" color="info" onClick={() => setApproveDlg(p)}><ApproveIcon fontSize="small" /></IconButton>
                            </Tooltip>
                          )}
                          {p.status === 'approved' && (
                            <Tooltip title="Record Payment (Posts Dr Salary Payable Cr Cash/Bank)">
                              <IconButton size="small" color="success" onClick={() => { setPayDlg(p); setPayForm({ paymentMethod: 'Cash', paymentReference: '', paymentDate: moment().format('YYYY-MM-DD') }); }}><PayIcon fontSize="small" /></IconButton>
                            </Tooltip>
                          )}
                          {p.status !== 'paid' && (
                            <Tooltip title="Add/Edit Deductions">
                              <IconButton size="small" color="warning" onClick={() => openDeductionDlg(p)}><EditIcon fontSize="small" /></IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Print Payslip">
                            <IconButton size="small" color="primary" onClick={() => printPayslip(p, companyName)}><PrintIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          {p.status !== 'paid' && (
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => setDeleteDlg(p)}><DeleteIcon fontSize="small" /></IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* ─── Generate Single Payroll Dialog ─── */}
      <Dialog open={generateDlg} onClose={() => setGenerateDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Generate Payroll</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Payroll is calculated based on teacher's salary structure: fixed salary, per-class attendance, or fee commission.
          </Alert>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Select Teacher *</InputLabel>
              <Select value={genForm.teacherId} label="Select Teacher *" onChange={e => setGenForm(f => ({ ...f, teacherId: e.target.value }))}>
                {(teachers || []).map(t => (
                  <MenuItem key={t._id} value={t._id}>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{t.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.salaryType?.replace('_', ' ')} — {t.annualSalary > 0 ? `Annual PKR ${Number(t.annualSalary).toLocaleString()}` : t.salaryType === 'per_class' ? `${(t.perClassRates || []).length} class rates` : t.salaryType === 'commission' ? `${(t.commissionRates || []).length} commission rates` : ''}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Month *" type="month" fullWidth InputLabelProps={{ shrink: true }}
              value={genForm.month} onChange={e => setGenForm(f => ({ ...f, month: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setGenerateDlg(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleGenerate} disabled={actioning} sx={{ fontWeight: 700 }}>
            {actioning ? <CircularProgress size={18} color="inherit" /> : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Bulk Generate Dialog ─── */}
      <Dialog open={bulkDlg} onClose={() => setBulkDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Bulk Generate Payroll</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will generate payroll for ALL teachers for the selected month. Existing payrolls will be skipped.
          </Alert>
          <TextField label="Month *" type="month" fullWidth InputLabelProps={{ shrink: true }}
            value={bulkMonth} onChange={e => setBulkMonth(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setBulkDlg(false)} color="inherit">Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleBulkGenerate} disabled={actioning} sx={{ fontWeight: 700 }}>
            {actioning ? <CircularProgress size={18} color="inherit" /> : `Generate for All ${(teachers || []).length} Teachers`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Approve Dialog ─── */}
      <Dialog open={!!approveDlg} onClose={() => setApproveDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'info.main' }}>
          <ApproveIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Approve Payroll
        </DialogTitle>
        <DialogContent>
          {approveDlg && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Approve payroll for <strong>{approveDlg.teacher?.name}</strong> — <strong>{moment(approveDlg.month).format('MMMM YYYY')}</strong>
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'info.50', borderRadius: 2, border: '1px solid', borderColor: 'info.light' }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Journal Entry (on Approve):</Typography>
                <Typography variant="body2">Dr Salary Expense &nbsp;&nbsp;&nbsp; PKR {Number(approveDlg.totalSalary || 0).toLocaleString()}</Typography>
                <Typography variant="body2" sx={{ ml: 4 }}>Cr Salary Payable &nbsp;&nbsp; PKR {Number(approveDlg.netSalary || 0).toLocaleString()}</Typography>
                {approveDlg.deductions > 0 && (
                  <Typography variant="body2" sx={{ ml: 4 }}>Cr Deductions &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PKR {Number(approveDlg.deductions || 0).toLocaleString()}</Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setApproveDlg(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="info" onClick={handleApprove} disabled={actioning} sx={{ fontWeight: 700 }}>
            {actioning ? <CircularProgress size={18} color="inherit" /> : 'Approve & Post Journal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Pay Dialog ─── */}
      <Dialog open={!!payDlg} onClose={() => setPayDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'success.main' }}>
          <PayIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Record Salary Payment
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {payDlg && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Pay <strong>PKR {Number(payDlg.netSalary || 0).toLocaleString()}</strong> to <strong>{payDlg.teacher?.name}</strong>
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Payment Method *</InputLabel>
                  <Select value={payForm.paymentMethod} label="Payment Method *"
                    onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    <MenuItem value="Cash">Cash</MenuItem>
                    <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                    <MenuItem value="Cheque">Cheque</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Payment Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                  value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} />
                <TextField label="Reference / Cheque No." fullWidth value={payForm.paymentReference}
                  onChange={e => setPayForm(f => ({ ...f, paymentReference: e.target.value }))} />
              </Stack>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'success.50', borderRadius: 2, border: '1px solid', borderColor: 'success.light' }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Journal Entry (on Payment):</Typography>
                <Typography variant="body2">Dr Salary Payable &nbsp;&nbsp; PKR {Number(payDlg.netSalary || 0).toLocaleString()}</Typography>
                <Typography variant="body2" sx={{ ml: 4 }}>Cr {payForm.paymentMethod === 'Cash' ? 'Cash' : 'Bank'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PKR {Number(payDlg.netSalary || 0).toLocaleString()}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPayDlg(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="success" onClick={handlePay} disabled={actioning} sx={{ fontWeight: 700 }}>
            {actioning ? <CircularProgress size={18} color="inherit" /> : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Deductions Dialog ─── */}
      <Dialog open={!!deductionDlg} onClose={() => setDeductionDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Deductions & Notes
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Gross: <strong>{fmt(deductionDlg?.totalSalary)}</strong> → Net after deductions: <strong>{fmt((deductionDlg?.totalSalary || 0) - deductionForm.deductions)}</strong>
          </Typography>
          {deductionForm.deductionDetails.map((d, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
              <TextField size="small" label="Description" sx={{ flex: 2 }} value={d.description}
                onChange={e => updateDeductionRow(i, 'description', e.target.value)} />
              <TextField size="small" label="Amount (PKR)" type="number" sx={{ flex: 1 }} value={d.amount}
                onChange={e => updateDeductionRow(i, 'amount', e.target.value)} />
              <IconButton size="small" color="error" onClick={() => removeDeductionRow(i)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addDeductionRow} sx={{ mb: 2 }}>Add Deduction</Button>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: 'error.50', borderRadius: 1, mb: 2 }}>
            <Typography fontWeight={700}>Total Deductions:</Typography>
            <Typography fontWeight={800} color="error.main">PKR {Number(deductionForm.deductions).toLocaleString()}</Typography>
          </Box>
          <TextField label="Notes" fullWidth multiline rows={2} value={deductionForm.notes}
            onChange={e => setDeductionForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeductionDlg(null)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleSaveDeductions} disabled={actioning} sx={{ fontWeight: 700 }}>
            {actioning ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Delete Dialog ─── */}
      <Dialog open={!!deleteDlg} onClose={() => setDeleteDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main', fontWeight: 700 }}>
          <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Delete Payroll
        </DialogTitle>
        <DialogContent>
          <Typography>Delete payroll for <strong>{deleteDlg?.teacher?.name}</strong> — <strong>{moment(deleteDlg?.month).format('MMM YYYY')}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDlg(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={actioning}>
            {actioning ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Payroll;
