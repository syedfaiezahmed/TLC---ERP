import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import moment from 'moment';
import {
  Box, Container, Paper, Typography, Tabs, Tab, Grid, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Alert, Snackbar,
  LinearProgress, Divider, Stack, Card, CardContent,
  ToggleButton, ToggleButtonGroup, Tooltip, Badge, alpha,
} from '@mui/material';
import { DialogContentSkeleton, TableRowSkeleton } from '../components/SkeletonLoaders';
import { useTheme } from '@mui/material/styles';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PaymentIcon from '@mui/icons-material/Payment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DeleteIcon from '@mui/icons-material/Delete';
import { getStudents } from '../redux/studentSlice';
import { getCourses } from '../redux/courseSlice';
import {
  generateVouchers, fetchVouchers, fetchVoucherById, fetchVoucherStatistics,
  updateVoucherStatus, collectFeePayment, fetchCollectionHistory, deleteFeePayment,
  fetchCollectionStatistics, fetchStudentCollectionHistory,
  fetchBadDebts, markAsBadDebt,
  fetchFeeCollectionReport, fetchPendingFeesReport,
  fetchStudentLedgerReport, fetchFeeSummaryReport, fetchDailyCollectionSummary,
  clearSuccess, clearError, clearSelectedVoucher, setError, deleteVoucher,
} from '../redux/feeManagementSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null || isNaN(n)) return 'PKR 0';
  return 'PKR ' + Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 });
};

const StatusChip = ({ status }) => {
  const map = {
    paid:      { label: 'Paid',      color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    partial:   { label: 'Partial',   color: 'warning', icon: <AccessTimeIcon sx={{ fontSize: 14 }} /> },
    pending:   { label: 'Pending',   color: 'default', icon: <AccessTimeIcon sx={{ fontSize: 14 }} /> },
    overdue:   { label: 'Overdue',   color: 'error',   icon: <WarningIcon sx={{ fontSize: 14 }} /> },
    cancelled: { label: 'Cancelled', color: 'default', icon: <ErrorIcon sx={{ fontSize: 14 }} /> },
  };
  const s = map[status] || map.pending;
  return <Chip label={s.label} color={s.color} size="small" icon={s.icon} sx={{ fontWeight: 600 }} />;
};

const StatCard = ({ title, value, icon, color, subtitle }) => {
  const theme = useTheme();
  return (
    <Card elevation={0} sx={{ border: `1px solid ${alpha(color, 0.2)}`, borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color, mt: 0.5, lineHeight: 1.2 }}>
              {value}
            </Typography>
            {subtitle && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{subtitle}</Typography>}
          </Box>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(color, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── Voucher Print Template ───────────────────────────────────────────────────
const VOUCHER_BLUE = '#1565C0';
const VOUCHER_GREEN = '#2E7D32';

const VoucherCopyBlock = ({ voucher, company, copyType }) => {
  const month = moment(voucher.month).format('MMMM YYYY');
  const dueDate = moment(voucher.dueDate);
  const isOverdue = moment().isAfter(dueDate, 'day');
  const accentColor = copyType === 'OFFICE COPY' ? VOUCHER_BLUE : VOUCHER_GREEN;
  const initials = (company?.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{
      flex: 1, padding: '10px 12px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: '"Roboto", Arial, sans-serif',
    }}>
      {/* ── Header: Logo + Name + Badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `2.5px solid ${accentColor}`, paddingBottom: 6, marginBottom: 8 }}>
        <img
          src="/logo.png"
          alt="TLC"
          style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0, borderRadius: '50%' }}
          onError={e => { e.target.style.display='none'; }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 10.5, color: accentColor, lineHeight: 1.2, letterSpacing: 0.3 }}>
            THE LEARNING COLLEGIATE
          </div>
          <div style={{ fontSize: 8, color: '#555', lineHeight: 1.3, fontWeight: 700, letterSpacing: 0.5 }}>North Campus</div>
          <div style={{ fontSize: 7.5, color: '#999', lineHeight: 1.2 }}>
            {[company?.phone, company?.address].filter(Boolean).join(' | ')}
          </div>
        </div>
        <div style={{ background: accentColor, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
          <div style={{ color: 'white', fontWeight: 900, fontSize: 7.5, textAlign: 'center' }}>{copyType}</div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 8.5, textAlign: 'center' }}>#{voucher.voucherNumber}</div>
        </div>
      </div>

      {/* ── Student Info Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', marginBottom: 8 }}>
        {[['Student', voucher.student?.name || '-'],
          ['Fee Month', month],
          ['Due Date', dueDate.format('DD MMM YYYY')],
          ['Contact', company?.phone || '-']
        ].map(([label, value], i) => (
          <div key={i}>
            <div style={{ fontSize: 7.5, color: '#999', lineHeight: 1 }}>{label}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: i === 2 && isOverdue ? '#c62828' : '#212121', lineHeight: 1.3 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Fee Table (Course | Fee | Discount | Net) ── */}
      {(() => {
        const cols = '1fr 48px 48px 48px';
        const totalOriginal = voucher.totalOriginalFee
          || ((voucher.enrollments || []).reduce((s, e) => s + (e.monthlyFee || 0), 0) + (voucher.admissionFee || 0));
        const totalDiscount = voucher.totalDiscount
          || (voucher.enrollments || []).reduce((s, e) => s + (e.discount || 0), 0);
        return (
          <div style={{ border: '1px solid #ddd', borderRadius: 3, overflow: 'hidden', marginBottom: 7, flex: 1 }}>
            <div style={{ background: accentColor, display: 'grid', gridTemplateColumns: cols, padding: '3px 8px' }}>
              {['Course', 'Fee', 'Disc', 'Net'].map(h => (
                <div key={h} style={{ color: 'white', fontWeight: 700, fontSize: 8, textAlign: h === 'Course' ? 'left' : 'right' }}>{h}</div>
              ))}
            </div>
            {(voucher.enrollments || []).map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, padding: '3px 8px', background: i % 2 === 0 ? '#fff' : '#f9fafe', borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: 8.5, color: '#333' }}>{e.courseName}</div>
                <div style={{ fontSize: 8.5, textAlign: 'right', color: '#555' }}>{fmt(e.monthlyFee)}</div>
                <div style={{ fontSize: 8.5, textAlign: 'right', color: e.discount > 0 ? '#c62828' : '#aaa' }}>
                  {e.discount > 0 ? `-${fmt(e.discount)}` : '—'}
                </div>
                <div style={{ fontSize: 8.5, textAlign: 'right', fontWeight: 700 }}>{fmt(e.netFee)}</div>
              </div>
            ))}
            {voucher.admissionFee > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '3px 8px', background: '#FFF8E1', borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: 8.5, color: '#E65100', fontWeight: 600 }}>Admission Fee</div>
                <div style={{ fontSize: 8.5, textAlign: 'right', color: '#E65100' }}>{fmt(voucher.admissionFee)}</div>
                <div style={{ fontSize: 8.5, textAlign: 'right', color: '#aaa' }}>—</div>
                <div style={{ fontSize: 8.5, textAlign: 'right', fontWeight: 700, color: '#E65100' }}>{fmt(voucher.admissionFee)}</div>
              </div>
            )}
            {totalDiscount > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '3px 8px', background: '#F5F5F5', borderTop: '1.5px solid #bbb', fontWeight: 800 }}>
                <div style={{ fontSize: 8.5, color: '#000' }}>TOTAL</div>
                <div style={{ fontSize: 8.5, textAlign: 'right', color: '#000' }}>{fmt(totalOriginal)}</div>
                <div style={{ fontSize: 8.5, textAlign: 'right', color: '#c62828' }}>-{fmt(totalDiscount)}</div>
                <div style={{ fontSize: 9, textAlign: 'right', color: accentColor }}>{fmt(voucher.totalFee)}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Totals ── */}
      <div style={{ background: '#E8F5E9', borderRadius: 3, padding: '5px 8px', marginBottom: 6, border: `1px solid ${accentColor}22` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: VOUCHER_GREEN }}>On Time (by {dueDate.format('DD MMM')}):</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: VOUCHER_GREEN }}>{fmt(voucher.totalFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 8, color: '#c62828' }}>After {dueDate.format('DD MMM')} + late fee {fmt(voucher.lateFeeAmount)}:</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#c62828' }}>{fmt(voucher.totalWithLateFee)}</span>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 7.5, color: '#aaa' }}>Issued: {moment(voucher.generatedDate).format('DD/MM/YYYY')}</span>
        <div style={{ borderTop: '1px solid #bbb', paddingTop: 2, textAlign: 'center', minWidth: 80 }}>
          <span style={{ fontSize: 7.5, color: '#aaa' }}>Authorized Signature</span>
        </div>
      </div>
    </div>
  );
};

const VoucherPrintTemplate = React.forwardRef(({ voucher, company }, ref) => {
  if (!voucher) return null;
  return (
    <div ref={ref} id="voucher-print-area" style={{ background: 'white', width: '100%' }}>
      {/* ── Top 48 %: Two copies side by side ── */}
      <div style={{ display: 'flex', width: '100%', height: 310, minHeight: 260, boxSizing: 'border-box', border: '1px solid #e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
        <VoucherCopyBlock voucher={voucher} company={company} copyType="OFFICE COPY" />
        <div style={{ width: 0, borderRight: '2px dashed #bbb', alignSelf: 'stretch' }} />
        <VoucherCopyBlock voucher={voucher} company={company} copyType="STUDENT COPY" />
      </div>
      {/* ── Bottom 52 %: White space (cut line) ── */}
      <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
        <div style={{ border: '1px dashed #999', width: '90%', textAlign: 'center', padding: '2px 0' }}>
          <span style={{ fontSize: 9, letterSpacing: 2, color: '#666' }}>✂ — — — — — — — — CUT HERE — — — — — — — —  ✂</span>
        </div>
      </div>
    </div>
  );
});
VoucherPrintTemplate.displayName = 'VoucherPrintTemplate';

// ─── Main Component ───────────────────────────────────────────────────────────
const FeeManagement = () => {
  const dispatch = useDispatch();
  const { companyId } = useParams();
  const theme = useTheme();
  const printRef = useRef();

  const { selectedCompany } = useSelector(s => s.companies || {});
  const { students = [] } = useSelector(s => s.students || {});
  const { courses = [] } = useSelector(s => s.courses || {});
  const {
    vouchers: rawVouchers, voucherStats, selectedVoucher,
    collectionHistory: rawCollectionHistory, collectionStats, studentPaymentHistory,
    collectionReport, pendingFeesReport, studentLedgerReport, summaryReport,
    badDebts: rawBadDebts, dailyCollection,
    loading, errors, successMessage,
  } = useSelector(s => s.feeManagement || {});

  // Defensive safe arrays — never undefined
  const vouchers = Array.isArray(rawVouchers) ? rawVouchers : [];
  const collectionHistory = Array.isArray(rawCollectionHistory) ? rawCollectionHistory : [];
  const badDebts = Array.isArray(rawBadDebts) ? rawBadDebts : [];

  const cid = companyId || selectedCompany?._id;

  // ─── Tab state ─────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState(0);
  const [reportTab, setReportTab] = useState(0);

  // ─── Voucher Generation state ───────────────────────────────────────────────
  const [voucherMonth, setVoucherMonth] = useState(moment().format('YYYY-MM'));
  const [voucherFilters, setVoucherFilters] = useState({ status: '', studentId: '', courseId: '' });
  const [voucherPreviewOpen, setVoucherPreviewOpen] = useState(false);
  const [printVoucher, setPrintVoucher] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState(null);

  // ─── Fee Collection state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedVoucherId, setSelectedVoucherId] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    amount: '', paymentType: 'full', paymentMethod: 'Cash',
    referenceNumber: '', notes: '', lateFeeIncluded: false, discountAmount: '',
  });
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);
  const [badDebtDialogOpen, setBadDebtDialogOpen] = useState(false);
  const [badDebtForm, setBadDebtForm] = useState({ reason: '', notes: '' });

  // ─── Report filters ─────────────────────────────────────────────────────────
  const [reportFilters, setReportFilters] = useState({
    startDate: moment().startOf('month').format('YYYY-MM-DD'),
    endDate: moment().endOf('month').format('YYYY-MM-DD'),
    studentId: '', courseId: '', status: '',
  });
  const [reportStudent, setReportStudent] = useState(null);

  // ─── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!cid) return;
    dispatch(getStudents({ companyId: cid, limit: 1000 }));
    dispatch(getCourses(cid));
  }, [cid, dispatch]);

  useEffect(() => {
    if (!cid) return;
    loadVouchers();
    dispatch(fetchVoucherStatistics({ companyId: cid }));
  }, [cid, voucherMonth, voucherFilters]);

  const loadVouchers = useCallback(() => {
    if (!cid) return;
    const startDate = moment(voucherMonth + '-01').startOf('month').format('YYYY-MM-DD');
    const endDate = moment(voucherMonth + '-01').endOf('month').format('YYYY-MM-DD');
    dispatch(fetchVouchers({
      companyId: cid,
      startDate,
      endDate,
      status: voucherFilters.status || undefined,
      student: voucherFilters.studentId || undefined,
      course: voucherFilters.courseId || undefined,
      limit: 100,
    }));
  }, [cid, voucherMonth, voucherFilters, dispatch]);

  // ─── Load collection data when tab changes ───────────────────────────────────
  useEffect(() => {
    if (mainTab === 1 && cid) {
      dispatch(fetchCollectionHistory({ companyId: cid }));
      dispatch(fetchCollectionStatistics({ companyId: cid }));
    }
  }, [mainTab, cid]);

  // ─── Load reports when report sub-tab changes ────────────────────────────────
  useEffect(() => {
    if (mainTab !== 2 || !cid) return;
    const params = { ...reportFilters, companyId: cid };
    switch (reportTab) {
      case 0: dispatch(fetchFeeCollectionReport({ companyId: cid, ...reportFilters })); break;
      case 1: dispatch(fetchPendingFeesReport({ companyId: cid, ...reportFilters })); break;
      case 2:
        if (reportStudent) dispatch(fetchStudentLedgerReport({ companyId: cid, studentId: reportStudent._id, ...reportFilters }));
        break;
      case 3: dispatch(fetchFeeSummaryReport({ companyId: cid, ...reportFilters })); break;
      case 4: dispatch(fetchBadDebts({ companyId: cid, ...reportFilters })); break;
      case 5: dispatch(fetchDailyCollectionSummary(reportFilters.startDate)); break;
    }
  }, [mainTab, reportTab, reportFilters, reportStudent, cid]);

  // ─── Voucher Generation ─────────────────────────────────────────────────────
  const handleGenerateVouchers = () => {
    const [year, month] = voucherMonth.split('-');
    const selectedDate = moment(`${year}-${month}-01`).format('YYYY-MM-DD');
    dispatch(generateVouchers({ selectedDate, companyId: cid })).then((res) => {
      if (!res.error) {
        setVoucherFilters({ status: '', studentId: '', courseId: '' });
        loadVouchers();
        dispatch(fetchVoucherStatistics({ companyId: cid }));
      } else {
        // Show detailed error from backend
        const errorMsg = res.payload?.error || res.payload?.message || 'Failed to generate vouchers';
        dispatch(setError({ key: 'generate', message: errorMsg }));
      }
    });
  };

  const handleDeleteVoucherClick = (voucher) => {
    setVoucherToDelete(voucher);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteVoucherConfirm = () => {
    if (!voucherToDelete) return;
    dispatch(deleteVoucher(voucherToDelete._id)).then((res) => {
      if (!res.error) {
        loadVouchers();
        dispatch(fetchVoucherStatistics({ companyId: cid }));
      }
    });
    setDeleteConfirmOpen(false);
    setVoucherToDelete(null);
  };

  const handlePreviewVoucher = (voucher) => {
    setPrintVoucher(voucher);
    setVoucherPreviewOpen(true);
  };

  const handlePrintVoucher = () => {
    const el = document.getElementById('voucher-print-area');
    if (!el) return;
    const printWin = window.open('', '_blank', 'width=794,height=1123');
    printWin.document.write(`
      <html><head><title>Fee Voucher</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 20px; background: white; }
        * { box-sizing: border-box; }
      </style></head>
      <body>${el.outerHTML}</body></html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
  };

  const handleDownloadPDF = async () => {
    const el = document.getElementById('voucher-print-area');
    if (!el || !printVoucher) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;
      const yOffset = (pdfH - imgH) / 2;
      pdf.addImage(imgData, 'PNG', 0, yOffset > 0 ? yOffset : 0, pdfW, Math.min(imgH, pdfH));
      pdf.save(`voucher-${printVoucher.voucherNumber}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  const handleExportAllPDF = async () => {
    if (!vouchers.length) return;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      let first = true;

      for (const v of vouchers) {
        // Render each voucher into a hidden offscreen div
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;';
        document.body.appendChild(container);

        const { createRoot } = await import('react-dom/client');
        const root = createRoot(container);
        await new Promise(resolve => {
          root.render(
            React.createElement(VoucherPrintTemplate, { voucher: v, company: selectedCompany })
          );
          setTimeout(resolve, 300);
        });

        const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        root.unmount();
        document.body.removeChild(container);

        const imgData = canvas.toDataURL('image/png');
        const imgH = (canvas.height * pdfW) / canvas.width;
        if (!first) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, Math.min(imgH, pdfH));
        first = false;
      }

      pdf.save(`vouchers-${voucherMonth}.pdf`);
    } catch (err) {
      console.error('Export All PDF failed:', err);
      dispatch(setError({ key: 'generate', message: 'Export failed: ' + err.message }));
    }
  };

  // ─── Fee Collection ─────────────────────────────────────────────────────────
  const handleVoucherSelect = (voucherId) => {
    setSelectedVoucherId(voucherId);
    dispatch(fetchVoucherById(voucherId));
    setCollectDialogOpen(true);
  };

  const handlePaymentTypeChange = (type, voucherData) => {
    if (!voucherData) return;
    const paid = voucherData.paidAmount || 0;
    let amount = '';
    let lateFeeIncluded = false;
    if (type === 'full_with_late') {
      // Collect the remaining base + late fee
      amount = Math.max(0, (voucherData.totalWithLateFee || voucherData.totalFee) - paid);
      lateFeeIncluded = true;
    } else if (type === 'base_only') {
      // Collect only remaining base fee — late fee is WAIVED (not recorded as revenue)
      amount = Math.max(0, voucherData.totalFee - paid);
      lateFeeIncluded = false;
    }
    setPaymentForm(p => ({ ...p, paymentType: type, amount, lateFeeIncluded }));
  };

  const handleCollectPayment = () => {
    dispatch(clearError('collect'));
    if (!selectedVoucher) {
      dispatch(setError({ key: 'collect', message: 'Voucher not loaded yet. Please wait and try again.' }));
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      dispatch(setError({ key: 'collect', message: 'Please enter a valid payment amount.' }));
      return;
    }
    dispatch(collectFeePayment({
      companyId: cid,
      voucherId: selectedVoucher._id,
      feeId: selectedVoucher.fee?._id || selectedVoucher.fee,
      studentId: selectedVoucher.student?._id || selectedVoucher.student,
      amount: parseFloat(paymentForm.amount),
      paymentMethod: paymentForm.paymentMethod,
      referenceNumber: paymentForm.referenceNumber,
      lateFeeIncluded: paymentForm.lateFeeIncluded,
      lateFeeAmount: paymentForm.lateFeeIncluded ? (selectedVoucher.lateFeeAmount || 0) : 0,
      discountAmount: parseFloat(paymentForm.discountAmount) || 0,
      discountReason: paymentForm.discountAmount > 0 ? 'Scholarship/Discount' : undefined,
      notes: paymentForm.notes,
      paymentDate: new Date().toISOString(),
    })).then((res) => {
      if (!res.error) {
        setCollectDialogOpen(false);
        setPaymentForm({ amount: '', paymentType: 'full', paymentMethod: 'Cash', referenceNumber: '', notes: '', lateFeeIncluded: false, discountAmount: '' });
        dispatch(clearError('collect'));
        loadVouchers();
      } else {
        const errMsg = res.payload?.message || res.payload?.error || 'Payment failed. Please try again.';
        dispatch(setError({ key: 'collect', message: errMsg }));
      }
    });
  };

  const handleMarkBadDebt = () => {
    if (!selectedVoucher) return;
    if (!badDebtForm.reason) {
      dispatch(setError({ key: 'badDebt', message: 'Please select a reason.' }));
      return;
    }
    dispatch(clearError('badDebt'));
    dispatch(markAsBadDebt({
      companyId: cid,
      feeId: selectedVoucher.fee?._id || selectedVoucher.fee || undefined,
      voucherId: selectedVoucher._id,
      reason: badDebtForm.reason,
      notes: badDebtForm.notes,
    })).then((res) => {
      if (!res.error) {
        setBadDebtDialogOpen(false);
        setBadDebtForm({ reason: '', notes: '' });
        dispatch(clearSelectedVoucher());
        loadVouchers();
        dispatch(fetchVoucherStatistics({ companyId: cid }));
      } else {
        const errMsg = res.payload?.message || res.payload?.error || 'Write-off failed. Please try again.';
        dispatch(setError({ key: 'badDebt', message: errMsg }));
      }
    });
  };

  // ─── Compute derived values for selected voucher ─────────────────────────────
  const voucherAmountInfo = selectedVoucher ? (() => {
    const today = moment();
    const due = moment(selectedVoucher.dueDate);
    const isOverdue = today.isAfter(due, 'day');
    const daysOverdue = isOverdue ? today.diff(due, 'days') : 0;
    const paid = selectedVoucher.paidAmount || 0;
    // Balance reflects current late-fee choice: if admin waives late fee, balance is base only.
    const applicable = (isOverdue && paymentForm.lateFeeIncluded)
      ? selectedVoucher.totalWithLateFee
      : selectedVoucher.totalFee;
    const balance = Math.max(0, applicable - paid);
    return { isOverdue, daysOverdue, paid, balance, applicable,
      baseFee: selectedVoucher.totalFee, lateFee: selectedVoucher.lateFeeAmount,
      totalWithLate: selectedVoucher.totalWithLateFee,
      totalOriginalFee: selectedVoucher.totalOriginalFee || 0,
      totalDiscount: selectedVoucher.totalDiscount || 0 };
  })() : null;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth={false} sx={{ mt: 3, mb: 4 }}>
      <Snackbar open={!!successMessage} autoHideDuration={4000} onClose={() => dispatch(clearSuccess())}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity="success" onClose={() => dispatch(clearSuccess())} sx={{ fontWeight: 600 }}>{successMessage}</Alert>
      </Snackbar>

      {/* Page Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Fee Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Voucher generation · Fee collection · Reports & Analytics
          </Typography>
        </Box>
        {voucherStats && (
          <Stack direction="row" spacing={1}>
            <Chip icon={<ReceiptIcon />} label={`${voucherStats.total || 0} Vouchers`} variant="outlined" />
            <Chip icon={<CheckCircleIcon />} label={`${voucherStats.paid || 0} Paid`} color="success" variant="outlined" />
            <Chip icon={<WarningIcon />} label={`${voucherStats.overdue || 0} Overdue`} color="error" variant="outlined" />
          </Stack>
        )}
      </Box>

      {/* Main Tabs */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}
          sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '0.95rem', minHeight: 56 } }}>
          <Tab icon={<ReceiptIcon />} iconPosition="start" label="Voucher Generation" />
          <Tab icon={<PaymentIcon />} iconPosition="start" label="Fee Collection" />
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Reports & Analytics" />
        </Tabs>

        {/* ══════════════════════ TAB 1: VOUCHER GENERATION ══════════════════════ */}
        {mainTab === 0 && (
          <Box sx={{ p: 3 }}>
            {/* Statistics Row */}
            {voucherStats && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Total Vouchers" value={voucherStats.total || 0} icon={<ReceiptIcon />} color={theme.palette.primary.main} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Paid" value={voucherStats.paid || 0} icon={<CheckCircleIcon />} color={theme.palette.success.main} subtitle={fmt(voucherStats.totalPaidAmount)} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Pending" value={voucherStats.pending || 0} icon={<AccessTimeIcon />} color={theme.palette.warning.main} subtitle={fmt(voucherStats.totalPendingAmount)} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Overdue" value={voucherStats.overdue || 0} icon={<WarningIcon />} color={theme.palette.error.main} subtitle={fmt(voucherStats.totalOverdueAmount)} />
                </Grid>
              </Grid>
            )}

            {/* Controls */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth label="Fee Month" type="month" size="small"
                    value={voucherMonth}
                    onChange={e => setVoucherMonth(e.target.value)}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Autocomplete size="small"
                    options={students} getOptionLabel={o => o.name || ''}
                    onChange={(_, v) => setVoucherFilters(f => ({ ...f, studentId: v?._id || '' }))}
                    renderInput={p => <TextField {...p} label="Filter by Student" />} />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={voucherFilters.status} label="Status"
                      onChange={e => setVoucherFilters(f => ({ ...f, status: e.target.value }))}>
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="paid">Paid</MenuItem>
                      <MenuItem value="partial">Partial</MenuItem>
                      <MenuItem value="overdue">Overdue</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs="auto" sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadVouchers}
                    disabled={loading.vouchers}>Refresh</Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={async () => {
                      try {
                        const { healVouchers } = await import('../services/api');
                        const res = await healVouchers(cid);
                        const msg = res?.data?.message || 'Heal complete.';
                        // eslint-disable-next-line no-alert
                        window.alert('✓ ' + msg);
                        loadVouchers();
                        dispatch(fetchVoucherStatistics({ companyId: cid }));
                      } catch (e) {
                        dispatch(setError({ key: 'generate', message: e.response?.data?.message || 'Repair failed' }));
                      }
                    }}
                    sx={{ textTransform: 'none' }}
                    title="Recompute paidAmount & status for all vouchers from FeePayment records"
                  >
                    Repair Statuses
                  </Button>
                  {vouchers.length > 0 && (
                    <Button variant="outlined" color="secondary" startIcon={<DownloadIcon />}
                      onClick={handleExportAllPDF} sx={{ textTransform: 'none' }}>
                      Export All PDF ({vouchers.length})
                    </Button>
                  )}
                  <Button variant="contained" startIcon={<AddIcon />}
                    onClick={handleGenerateVouchers}
                    disabled={loading.generate}
                    sx={{ fontWeight: 700, textTransform: 'none' }}>
                    {loading.generate ? 'Generating…' : `Generate ${moment(voucherMonth).format('MMM YYYY')} Vouchers`}
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {errors.generate && <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError('generate'))}>{errors.generate}</Alert>}

            {/* Vouchers Table */}
            {loading.vouchers ? <LinearProgress /> : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Voucher #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Courses</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Base Fee</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>With Late Fee</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(vouchers) && vouchers.length > 0 ? vouchers.map(v => (
                      <TableRow key={v._id} hover
                        sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} color="primary.main">{v.voucherNumber}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2">{v.student?.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {v.enrollments?.map((e, i) => (
                            <Chip key={i} label={e.courseName} size="small" variant="outlined"
                              sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }} />
                          ))}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600} color="success.main">{fmt(v.totalFee)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600} color="error.main">{fmt(v.totalWithLateFee)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color={moment().isAfter(moment(v.dueDate), 'day') ? 'error.main' : 'text.primary'}>
                            {moment(v.dueDate).format('DD MMM YYYY')}
                          </Typography>
                        </TableCell>
                        <TableCell><StatusChip status={v.status} /></TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Preview & Print">
                              <IconButton size="small" color="primary" onClick={() => handlePreviewVoucher(v)}>
                                <PrintIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {v.status !== 'paid' && (
                              <Tooltip title="Record Payment">
                                <IconButton size="small" color="success" onClick={() => handleVoucherSelect(v._id)}>
                                  <PaymentIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete Voucher">
                              <IconButton size="small" color="error" onClick={() => handleDeleteVoucherClick(v)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                          <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                          <Typography color="text.secondary">
                            No vouchers found. Click "Generate Vouchers" to create monthly fee vouchers.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* ══════════════════════ TAB 2: FEE COLLECTION ══════════════════════ */}
        {mainTab === 1 && (
          <Box sx={{ p: 3 }}>
            {/* Collection Statistics */}
            {collectionStats && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Total Collected" value={fmt(collectionStats.summary?.totalAmount)}
                    icon={<TrendingUpIcon />} color={theme.palette.success.main}
                    subtitle={`${collectionStats.summary?.totalPayments || 0} payments`} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Late Fee Collected" value={fmt(collectionStats.summary?.totalLateFee)}
                    icon={<WarningIcon />} color={theme.palette.warning.main} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Discounts Given" value={fmt(collectionStats.summary?.totalDiscount)}
                    icon={<MoneyOffIcon />} color={theme.palette.info.main} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard title="Avg Payment" value={fmt(collectionStats.summary?.avgPaymentAmount)}
                    icon={<AccountBalanceIcon />} color={theme.palette.secondary.main} />
                </Grid>
              </Grid>
            )}

            {/* Search & Quick Collect */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Quick Fee Collection</Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <Autocomplete size="small"
                    options={students} getOptionLabel={o => `${o.name} (${o.rollNumber || o._id?.slice(-4)})`}
                    value={selectedStudent}
                    onChange={(_, v) => {
                      setSelectedStudent(v);
                      if (v) {
                        dispatch(fetchStudentCollectionHistory(v._id));
                        dispatch(fetchVouchers({ companyId: cid, student: v._id, limit: 50 }));
                      }
                    }}
                    renderInput={p => <TextField {...p} label="Search Student" InputProps={{ ...p.InputProps, startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }} />}
                  />
                </Grid>
                {selectedStudent && vouchers && (
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Voucher</InputLabel>
                      <Select value={selectedVoucherId} label="Select Voucher"
                        onChange={e => { setSelectedVoucherId(e.target.value); handleVoucherSelect(e.target.value); }}>
                        {(vouchers || []).filter(v => v.student?._id === selectedStudent._id || v.student === selectedStudent._id).map(v => (
                          <MenuItem key={v._id} value={v._id}>
                            {v.voucherNumber} — {moment(v.month).format('MMM YYYY')} — {fmt(v.totalFee)}
                            {v.status === 'overdue' ? ' ⚠️' : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>

              {/* Student Payment History */}
              {studentPaymentHistory && selectedStudent && (
                <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Payment History — {selectedStudent.name}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Total Paid</Typography>
                      <Typography variant="body1" fontWeight={700} color="success.main">
                        {fmt(studentPaymentHistory.summary?.totalPaid)}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                      <Typography variant="body1" fontWeight={700} color="error.main">
                        {fmt(studentPaymentHistory.summary?.totalOutstanding)}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Total Payments</Typography>
                      <Typography variant="body1" fontWeight={700}>
                        {studentPaymentHistory.payments?.length || 0}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Paper>

            {/* Collection History Table */}
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Recent Collections</Typography>
            {loading.collectionHistory ? <LinearProgress /> : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Payment #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Late Fee</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Discount</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Received By</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(collectionHistory) && collectionHistory.length > 0 ? collectionHistory.map(p => (
                      <TableRow key={p._id} hover>
                        <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{p.paymentNumber}</Typography></TableCell>
                        <TableCell>{p.student?.name}</TableCell>
                        <TableCell>{moment(p.paymentDate).format('DD MMM YYYY')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmt(p.amount)}</TableCell>
                        <TableCell><Chip label={p.paymentMethod} size="small" variant="outlined" /></TableCell>
                        <TableCell align="right">{p.lateFeeAmount > 0 ? <Typography variant="body2" color="warning.main" fontWeight={600}>{fmt(p.lateFeeAmount)}</Typography> : '-'}</TableCell>
                        <TableCell align="right">{p.discountAmount > 0 ? <Typography variant="body2" color="info.main" fontWeight={600}>-{fmt(p.discountAmount)}</Typography> : '-'}</TableCell>
                        <TableCell>{p.receivedBy?.name || '-'}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error"
                            onClick={() => {
                              if (window.confirm(`Delete payment ${p.paymentNumber}? This will reverse all journal entries.`)) {
                                dispatch(deleteFeePayment(p._id));
                              }
                            }}
                            title="Delete & reverse journal">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No payments recorded yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* ══════════════════════ TAB 3: REPORTS ══════════════════════ */}
        {mainTab === 2 && (
          <Box sx={{ p: 3 }}>
            {/* Report Filters */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth size="small" label="From Date" type="date"
                    value={reportFilters.startDate}
                    onChange={e => setReportFilters(f => ({ ...f, startDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth size="small" label="To Date" type="date"
                    value={reportFilters.endDate}
                    onChange={e => setReportFilters(f => ({ ...f, endDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
                {reportTab === 2 && (
                  <Grid item xs={12} sm={3}>
                    <Autocomplete size="small" options={students}
                      getOptionLabel={o => o.name || ''}
                      value={reportStudent}
                      onChange={(_, v) => setReportStudent(v)}
                      renderInput={p => <TextField {...p} label="Select Student" />} />
                  </Grid>
                )}
                <Grid item xs="auto">
                  <Button variant="contained" startIcon={<RefreshIcon />} onClick={() => setReportFilters(f => ({ ...f }))}>
                    Run Report
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {/* Report Sub-tabs */}
            <Tabs value={reportTab} onChange={(_, v) => setReportTab(v)} variant="scrollable"
              sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider',
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem' } }}>
              <Tab label="Fee Collection" />
              <Tab label="Outstanding / Pending" />
              <Tab label="Student Ledger" />
              <Tab label="Monthly Summary" />
              <Tab label="Bad Debts" />
              <Tab label="Daily Collection" />
            </Tabs>

            {/* ── Report Tab 0: Fee Collection ── */}
            {reportTab === 0 && (
              <Box>
                {loading.collectionReport ? <LinearProgress /> : collectionReport ? (
                  <>
                    {collectionReport.summary && (
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={3}><StatCard title="Total Collected" value={fmt(collectionReport.summary.netCollection)} icon={<TrendingUpIcon />} color={theme.palette.success.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Total Payments" value={collectionReport.summary.totalPayments || 0} icon={<ReceiptIcon />} color={theme.palette.primary.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Late Fee" value={fmt(collectionReport.summary.totalLateFee)} icon={<WarningIcon />} color={theme.palette.warning.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Discounts" value={fmt(collectionReport.summary.totalDiscount)} icon={<MoneyOffIcon />} color={theme.palette.info.main} /></Grid>
                      </Grid>
                    )}
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'background.default' }}>
                          <TableRow>
                            {['Date', 'Payment #', 'Student', 'Fee #', 'Amount', 'Method', 'Late Fee', 'Discount'].map(h => (
                              <TableCell key={h} sx={{ fontWeight: 700 }} align={['Amount', 'Late Fee', 'Discount'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {collectionReport.payments?.map(p => (
                            <TableRow key={p._id} hover>
                              <TableCell>{moment(p.paymentDate).format('DD-MM-YYYY')}</TableCell>
                              <TableCell><Typography variant="body2" fontWeight={600}>{p.paymentNumber}</Typography></TableCell>
                              <TableCell>{p.student?.name}</TableCell>
                              <TableCell>{p.fee?.feeNumber}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmt(p.amount)}</TableCell>
                              <TableCell><Chip label={p.paymentMethod} size="small" /></TableCell>
                              <TableCell align="right">{p.lateFeeAmount > 0 ? fmt(p.lateFeeAmount) : '-'}</TableCell>
                              <TableCell align="right">{p.discountAmount > 0 ? fmt(p.discountAmount) : '-'}</TableCell>
                            </TableRow>
                          ))}
                          {!collectionReport.payments?.length && (
                            <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No records found.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : <Box p={5} textAlign="center"><Typography color="text.secondary">Select date range and click Run Report</Typography></Box>}
              </Box>
            )}

            {/* ── Report Tab 1: Outstanding / Pending ── */}
            {reportTab === 1 && (
              <Box>
                {loading.pendingReport ? <LinearProgress /> : pendingFeesReport ? (
                  <>
                    {pendingFeesReport.summary && (
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={3}><StatCard title="Total Pending" value={fmt(pendingFeesReport.summary.totalPending)} icon={<WarningIcon />} color={theme.palette.error.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Overdue Amount" value={fmt(pendingFeesReport.summary.overdueAmount)} icon={<ErrorIcon />} color={theme.palette.warning.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Overdue Count" value={pendingFeesReport.summary.overdueCount || 0} icon={<AccessTimeIcon />} color={theme.palette.warning.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Overdue %" value={`${(pendingFeesReport.summary.overduePercentage || 0).toFixed(1)}%`} icon={<AssessmentIcon />} color={theme.palette.info.main} /></Grid>
                      </Grid>
                    )}
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'background.default' }}>
                          <TableRow>
                            {['Voucher #', 'Student', 'Student ID', 'Due Date', 'Total Fee', 'Paid', 'Discount', 'Balance', 'Days Overdue', 'Status'].map(h => (
                              <TableCell key={h} sx={{ fontWeight: 700 }} align={['Total Fee', 'Paid', 'Discount', 'Balance', 'Days Overdue'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pendingFeesReport.pendingFees?.map(f => (
                            <TableRow key={f._id} hover>
                              <TableCell><Typography variant="body2" fontWeight={600}>{f.voucherNumber || f.feeNumber}</Typography></TableCell>
                              <TableCell>{f.student?.name}</TableCell>
                              <TableCell>{f.student?.studentId || f.student?.rollNumber || '-'}</TableCell>
                              <TableCell sx={{ color: f.daysOverdue > 0 ? 'error.main' : 'text.primary' }}>{moment(f.dueDate).format('DD-MM-YYYY')}</TableCell>
                              <TableCell align="right">{fmt(f.totalFee || f.totalAmount)}</TableCell>
                              <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(f.paidAmount)}</TableCell>
                              <TableCell align="right" sx={{ color: 'info.main' }}>{fmt(f.paymentDiscountTotal || 0)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{fmt(f.balanceDue)}</TableCell>
                              <TableCell align="right">
                                <Chip label={f.daysOverdue > 0 ? `${f.daysOverdue}d` : 'Current'}
                                  size="small" color={f.daysOverdue > 30 ? 'error' : f.daysOverdue > 0 ? 'warning' : 'success'}
                                  sx={{ fontWeight: 700 }} />
                              </TableCell>
                              <TableCell><StatusChip status={f.status} /></TableCell>
                            </TableRow>
                          ))}
                          {!pendingFeesReport.pendingFees?.length && (
                            <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}>No pending vouchers found.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : <Box p={5} textAlign="center"><Typography color="text.secondary">Select date range and click Run Report</Typography></Box>}
              </Box>
            )}

            {/* ── Report Tab 2: Student Ledger ── */}
            {reportTab === 2 && (
              <Box>
                {!reportStudent ? (
                  <Box p={5} textAlign="center">
                    <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">Select a student above to view their ledger.</Typography>
                  </Box>
                ) : loading.ledgerReport ? <LinearProgress /> : studentLedgerReport ? (
                  <>
                    {studentLedgerReport.summary && (
                      <Box sx={{ p: 2, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.15) }}>
                        <Grid container spacing={2}>
                          <Grid item xs={6} sm={3}><StatCard title="Total Fees" value={fmt(studentLedgerReport.summary.totalDebit)} icon={<ReceiptIcon />} color={theme.palette.primary.main} /></Grid>
                          <Grid item xs={6} sm={3}><StatCard title="Total Paid" value={fmt(studentLedgerReport.summary.totalCredit)} icon={<CheckCircleIcon />} color={theme.palette.success.main} /></Grid>
                          <Grid item xs={6} sm={3}><StatCard title="Discount" value={fmt(studentLedgerReport.summary.totalDiscount || 0)} icon={<MoneyOffIcon />} color={theme.palette.warning.main} /></Grid>
                          <Grid item xs={6} sm={3}><StatCard title="Balance" value={fmt(studentLedgerReport.summary.closingBalance)} icon={<AccountBalanceIcon />}
                            color={studentLedgerReport.summary.closingBalance > 0 ? theme.palette.error.main : theme.palette.success.main} /></Grid>
                        </Grid>
                      </Box>
                    )}
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'background.default' }}>
                          <TableRow>
                            {['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'].map(h => (
                              <TableCell key={h} sx={{ fontWeight: 700 }} align={['Debit', 'Credit', 'Balance'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {studentLedgerReport.transactions?.map((t, idx) => (
                            <TableRow key={`${t.reference || 'tx'}-${idx}`} hover>
                              <TableCell>{moment(t.date).format('DD-MM-YYYY')}</TableCell>
                              <TableCell>{t.description}</TableCell>
                              <TableCell>{t.reference || '-'}</TableCell>
                              <TableCell align="right">{t.debit > 0 ? <Typography variant="body2" color="error.main" fontWeight={600}>{fmt(t.debit)}</Typography> : '-'}</TableCell>
                              <TableCell align="right">{t.credit > 0 ? <Typography variant="body2" color={t.type === 'discount' ? 'info.main' : 'success.main'} fontWeight={600}>{fmt(t.credit)}</Typography> : '-'}</TableCell>
                              <TableCell align="right"><Typography variant="body2" fontWeight={700}>{fmt(t.balance ?? t.runningBalance)}</Typography></TableCell>
                            </TableRow>
                          ))}
                          {!studentLedgerReport.transactions?.length && (
                            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No transactions found.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : <Box p={5} textAlign="center"><Typography color="text.secondary">Click Run Report to load ledger.</Typography></Box>}
              </Box>
            )}

            {/* ── Report Tab 3: Monthly Summary ── */}
            {reportTab === 3 && (
              <Box>
                {loading.summaryReport ? <LinearProgress /> : summaryReport ? (
                  <>
                    {summaryReport.totals && (
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={3}><StatCard title="Total Fees Generated" value={fmt(summaryReport.totals.totalFees)} icon={<ReceiptIcon />} color={theme.palette.primary.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Total Collected" value={fmt(summaryReport.totals.totalCollected)} icon={<TrendingUpIcon />} color={theme.palette.success.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Total Pending" value={fmt(summaryReport.totals.pendingAmount)} icon={<WarningIcon />} color={theme.palette.warning.main} /></Grid>
                        <Grid item xs={6} sm={3}><StatCard title="Late Fee Income" value={fmt(summaryReport.totals.totalLateFee)} icon={<AccessTimeIcon />} color={theme.palette.error.main} /></Grid>
                      </Grid>
                    )}
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'background.default' }}>
                          <TableRow>
                            {['Period', 'Total Fees', 'Collected', 'Late Fee', 'Discount', 'Net Collection', 'Pending'].map(h => (
                              <TableCell key={h} sx={{ fontWeight: 700 }} align={h === 'Period' ? 'left' : 'right'}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {summaryReport.summary?.map((row, i) => (
                            <TableRow key={i} hover>
                              <TableCell fontWeight={600}>{row.period}</TableCell>
                              <TableCell align="right">{fmt(row.totalFees)}</TableCell>
                              <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{fmt(row.totalCollected)}</TableCell>
                              <TableCell align="right">{fmt(row.totalLateFee)}</TableCell>
                              <TableCell align="right">{fmt(row.totalDiscount)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(row.netCollection)}</TableCell>
                              <TableCell align="right" sx={{ color: 'error.main' }}>{fmt(row.pendingAmount)}</TableCell>
                            </TableRow>
                          ))}
                          {!summaryReport.summary?.length && (
                            <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>No data found.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : <Box p={5} textAlign="center"><Typography color="text.secondary">Select date range and click Run Report</Typography></Box>}
              </Box>
            )}

            {/* ── Report Tab 4: Bad Debts ── */}
            {reportTab === 4 && (
              <Box>
                {loading.badDebts ? <LinearProgress /> : (
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'background.default' }}>
                        <TableRow>
                          {['Write-off Date', 'Student', 'Fee #', 'Amount Written Off', 'Reason', 'Status'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 700 }} align={h === 'Amount Written Off' ? 'right' : 'left'}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Array.isArray(badDebts) && badDebts.length > 0 ? badDebts.map(b => (
                          <TableRow key={b._id} hover>
                            <TableCell>{moment(b.writeOffDate || b.createdAt).format('DD-MM-YYYY')}</TableCell>
                            <TableCell>{b.student?.name}</TableCell>
                            <TableCell>{b.fee?.feeNumber || '-'}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main', fontWeight: 700 }}>{fmt(b.writtenOffAmount)}</TableCell>
                            <TableCell>{b.reason || '-'}</TableCell>
                            <TableCell><Chip label={b.status || 'written-off'} size="small" color="error" /></TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <MoneyOffIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                            <Typography color="text.secondary" display="block">No bad debts recorded.</Typography>
                          </TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

            {/* ── Report Tab 5: Daily Collection ── */}
            {reportTab === 5 && (
              <Box>
                {loading.dailyCollection ? <LinearProgress /> : dailyCollection ? (
                  <>
                    <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.success.main, 0.05), borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.2) }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                        Daily Report — {moment(dailyCollection.date).format('DD MMMM YYYY')}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={4}><StatCard title="Total Collected" value={fmt(dailyCollection.summary?.totalAmount)} icon={<TrendingUpIcon />} color={theme.palette.success.main} /></Grid>
                        <Grid item xs={4}><StatCard title="Payments" value={dailyCollection.summary?.totalPayments || 0} icon={<ReceiptIcon />} color={theme.palette.primary.main} /></Grid>
                        <Grid item xs={4}><StatCard title="Late Fee" value={fmt(dailyCollection.summary?.totalLateFee)} icon={<WarningIcon />} color={theme.palette.warning.main} /></Grid>
                      </Grid>
                    </Box>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'background.default' }}>
                          <TableRow>
                            {['Time', 'Payment #', 'Student', 'Amount', 'Method', 'Late Fee', 'Received By'].map(h => (
                              <TableCell key={h} sx={{ fontWeight: 700 }} align={['Amount', 'Late Fee'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dailyCollection.payments?.map(p => (
                            <TableRow key={p._id} hover>
                              <TableCell>{moment(p.paymentDate).format('hh:mm A')}</TableCell>
                              <TableCell>{p.paymentNumber}</TableCell>
                              <TableCell>{p.student?.name}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmt(p.amount)}</TableCell>
                              <TableCell><Chip label={p.paymentMethod} size="small" /></TableCell>
                              <TableCell align="right">{p.lateFeeAmount > 0 ? fmt(p.lateFeeAmount) : '-'}</TableCell>
                              <TableCell>{p.receivedBy?.name}</TableCell>
                            </TableRow>
                          ))}
                          {!dailyCollection.payments?.length && (
                            <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>No collections today.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : <Box p={5} textAlign="center"><Typography color="text.secondary">Select a date and click Run Report</Typography></Box>}
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* ══════════════════════ DELETE CONFIRM DIALOG ══════════════════════ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon fontSize="small" /> Delete Voucher
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete voucher <strong>{voucherToDelete?.voucherNumber}</strong> for{' '}
            <strong>{voucherToDelete?.student?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} variant="outlined">Cancel</Button>
          <Button onClick={handleDeleteVoucherConfirm} variant="contained" color="error" startIcon={<DeleteIcon />}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════ VOUCHER PREVIEW DIALOG ══════════════════════ */}
      <Dialog open={voucherPreviewOpen} onClose={() => setVoucherPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
          <Typography fontWeight={700} fontSize={15}>Fee Voucher — {printVoucher?.voucherNumber}</Typography>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<PrintIcon />} variant="outlined" size="small" onClick={handlePrintVoucher}>Print</Button>
            <Button startIcon={<DownloadIcon />} variant="contained" size="small" onClick={handleDownloadPDF}>Download PDF</Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1, bgcolor: '#f5f5f5' }}>
          <VoucherPrintTemplate ref={printRef} voucher={printVoucher} company={selectedCompany} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoucherPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════ COLLECT PAYMENT DIALOG ══════════════════════ */}
      <Dialog open={collectDialogOpen} onClose={() => {
        setCollectDialogOpen(false);
        dispatch(clearSelectedVoucher());
        dispatch(clearError('collect'));
        setPaymentForm({ amount: '', paymentType: 'full', paymentMethod: 'Cash', referenceNumber: '', notes: '', lateFeeIncluded: false, discountAmount: '' });
      }} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Record Fee Payment</DialogTitle>
        {errors.collect && <Alert severity="error" sx={{ mx: 3, mt: 2 }} onClose={() => dispatch(clearError('collect'))}>{errors.collect}</Alert>}
        <DialogContent dividers>
          {loading.voucherDetail ? <LinearProgress sx={{ mb: 2 }} /> : selectedVoucher && voucherAmountInfo ? (
            <Box>
              {/* Student & Voucher Info */}
              <Box sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                <Grid container spacing={1}>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Student</Typography><Typography fontWeight={700}>{selectedVoucher.student?.name}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Voucher #</Typography><Typography fontWeight={700}>{selectedVoucher.voucherNumber}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Month</Typography><Typography fontWeight={600}>{moment(selectedVoucher.month).format('MMMM YYYY')}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Due Date</Typography>
                    <Typography fontWeight={600} color={voucherAmountInfo.isOverdue ? 'error.main' : 'success.main'}>
                      {moment(selectedVoucher.dueDate).format('DD MMM YYYY')} {voucherAmountInfo.isOverdue && `(${voucherAmountInfo.daysOverdue}d overdue)`}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Fee Breakdown (Original → Discount → Net) */}
              {voucherAmountInfo.totalDiscount > 0 && (
                <Box sx={{ p: 1.5, mb: 1.5, bgcolor: alpha(theme.palette.info.main, 0.06), borderRadius: 2, border: '1px dashed', borderColor: 'info.main' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Original Fee</Typography>
                    <Typography variant="body2" fontWeight={600}>{fmt(voucherAmountInfo.totalOriginalFee)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="error.main">Discount Applied</Typography>
                    <Typography variant="body2" fontWeight={600} color="error.main">- {fmt(voucherAmountInfo.totalDiscount)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 0.5, mt: 0.5 }}>
                    <Typography variant="caption" fontWeight={700}>Net Fee (Base)</Typography>
                    <Typography variant="body2" fontWeight={800} color="primary.main">{fmt(voucherAmountInfo.baseFee)}</Typography>
                  </Stack>
                </Box>
              )}

              {/* Already-Paid Info */}
              {voucherAmountInfo.paid > 0 && (
                <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
                  <Typography variant="caption">Already paid: <strong>{fmt(voucherAmountInfo.paid)}</strong> — remaining balance shown below.</Typography>
                </Alert>
              )}

              {/* Amount Selection */}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Select Payment Amount</Typography>
              <Stack spacing={1.5} sx={{ mb: 2 }}>
                {voucherAmountInfo.isOverdue && (
                  <Paper
                    variant={paymentForm.paymentType === 'full_with_late' ? 'elevation' : 'outlined'}
                    elevation={paymentForm.paymentType === 'full_with_late' ? 4 : 0}
                    sx={{ p: 2, cursor: 'pointer', borderRadius: 2, border: paymentForm.paymentType === 'full_with_late' ? `2px solid ${theme.palette.primary.main}` : '1px solid', borderColor: paymentForm.paymentType === 'full_with_late' ? 'primary.main' : 'divider' }}
                    onClick={() => handlePaymentTypeChange('full_with_late', selectedVoucher)}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={700}>Full Amount (with Late Fee)</Typography>
                        <Typography variant="caption" color="text.secondary">Base {fmt(voucherAmountInfo.baseFee)} + Late Fee {fmt(voucherAmountInfo.lateFee)}</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight={800} color="error.main">{fmt(Math.max(0, voucherAmountInfo.totalWithLate - voucherAmountInfo.paid))}</Typography>
                    </Stack>
                  </Paper>
                )}

                <Paper
                  variant={paymentForm.paymentType === 'base_only' ? 'elevation' : 'outlined'}
                  elevation={paymentForm.paymentType === 'base_only' ? 4 : 0}
                  sx={{ p: 2, cursor: 'pointer', borderRadius: 2, border: paymentForm.paymentType === 'base_only' ? `2px solid ${theme.palette.success.main}` : '1px solid', borderColor: paymentForm.paymentType === 'base_only' ? 'success.main' : 'divider' }}
                  onClick={() => handlePaymentTypeChange('base_only', selectedVoucher)}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{voucherAmountInfo.isOverdue ? 'Base Fee Only (Waive Late Fee)' : 'Full Base Fee'}</Typography>
                      <Typography variant="caption" color="text.secondary">{voucherAmountInfo.isOverdue ? 'Late fee waived — not recorded as revenue' : 'Pay the net fee on time'}</Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={800} color="success.main">{fmt(Math.max(0, voucherAmountInfo.baseFee - voucherAmountInfo.paid))}</Typography>
                  </Stack>
                </Paper>

                <Paper
                  variant={paymentForm.paymentType === 'custom' ? 'elevation' : 'outlined'}
                  elevation={paymentForm.paymentType === 'custom' ? 4 : 0}
                  sx={{ p: 2, cursor: 'pointer', borderRadius: 2, border: paymentForm.paymentType === 'custom' ? `2px solid ${theme.palette.warning.main}` : '1px solid', borderColor: paymentForm.paymentType === 'custom' ? 'warning.main' : 'divider' }}
                  onClick={() => setPaymentForm(p => ({ ...p, paymentType: 'custom', amount: '' }))}>
                  <Typography variant="body2" fontWeight={700}>Custom / Partial Amount</Typography>
                  <Typography variant="caption" color="text.secondary">Enter any amount (partial payment supported)</Typography>
                </Paper>
              </Stack>

              {/* Amount Input */}
              <TextField fullWidth size="small" label="Payment Amount (PKR)" type="number"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>PKR</Typography> }}
                sx={{ mb: 2 }} />

              {/* Payment Details */}
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Method</InputLabel>
                    <Select value={paymentForm.paymentMethod} label="Payment Method"
                      onChange={e => setPaymentForm(p => ({ ...p, paymentMethod: e.target.value }))}>
                      {['Cash', 'Bank Transfer', 'Cheque', 'Online', 'UPI'].map(m => (
                        <MenuItem key={m} value={m}>{m}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Reference #"
                    value={paymentForm.referenceNumber}
                    onChange={e => setPaymentForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Scholarship / Discount (PKR)" type="number"
                    value={paymentForm.discountAmount}
                    onChange={e => setPaymentForm(p => ({ ...p, discountAmount: e.target.value }))}
                    helperText="Dr Scholarship/Discount, Cr Fee Revenue" />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Notes (optional)"
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
                </Grid>
              </Grid>

              {/* Mark as Bad Debt link */}
              <Box sx={{ mt: 2, textAlign: 'right' }}>
                <Button color="error" size="small" startIcon={<MoneyOffIcon />}
                  onClick={() => { setCollectDialogOpen(false); setBadDebtDialogOpen(true); }}>
                  Mark as Bad Debt
                </Button>
              </Box>
            </Box>
          ) : <DialogContentSkeleton rows={4} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCollectDialogOpen(false);
            dispatch(clearSelectedVoucher());
            dispatch(clearError('collect'));
            setPaymentForm({ amount: '', paymentType: 'full', paymentMethod: 'Cash', referenceNumber: '', notes: '', lateFeeIncluded: false, discountAmount: '' });
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleCollectPayment}
            disabled={!selectedVoucher || !paymentForm.amount || loading.collectPayment || loading.voucherDetail}
            color="success" sx={{ fontWeight: 700, minWidth: 140 }}>
            {loading.collectPayment ? 'Processing…' : `Collect ${paymentForm.amount && !isNaN(parseFloat(paymentForm.amount)) ? fmt(parseFloat(paymentForm.amount)) : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════ BAD DEBT DIALOG ══════════════════════ */}
      <Dialog open={badDebtDialogOpen} onClose={() => {
        setBadDebtDialogOpen(false);
        dispatch(clearError('badDebt'));
      }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ color: 'error.main' }}>Mark as Bad Debt</DialogTitle>
        {errors.badDebt && <Alert severity="error" sx={{ mx: 3, mt: 1 }} onClose={() => dispatch(clearError('badDebt'))}>{errors.badDebt}</Alert>}
        <DialogContent dividers>
          {selectedVoucher && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Writing off <strong>{fmt(selectedVoucher.totalFee)}</strong> for <strong>{selectedVoucher.student?.name}</strong>.
              This will create a Bad Debt Expense entry in the accounts.
            </Alert>
          )}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Reason</InputLabel>
            <Select value={badDebtForm.reason} label="Reason"
              onChange={e => setBadDebtForm(f => ({ ...f, reason: e.target.value }))}>
              <MenuItem value="student_left">Student Left Institute</MenuItem>
              <MenuItem value="financial_hardship">Financial Hardship</MenuItem>
              <MenuItem value="unreachable">Student Unreachable</MenuItem>
              <MenuItem value="dispute">Fee Dispute</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Notes" multiline rows={2}
            value={badDebtForm.notes}
            onChange={e => setBadDebtForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setBadDebtDialogOpen(false);
            dispatch(clearError('badDebt'));
          }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleMarkBadDebt}
            disabled={!badDebtForm.reason || loading.markBadDebt}>
            {loading.markBadDebt ? 'Processing…' : 'Confirm Write-Off'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FeeManagement;
