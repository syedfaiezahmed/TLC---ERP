import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  fetchFeeCollectionReport,
  fetchPendingFeesReport,
  fetchStudentLedgerReport,
  fetchSummaryReport,
  fetchVoucherReport,
  clearErrors,
  resetReport
} from '../redux/feeReportsSlice';
import { getStudents } from '../redux/studentSlice';
import { getTeachers } from '../redux/teacherSlice';
import { getCourses } from '../redux/courseSlice';
import { getBatches } from '../redux/batchSlice';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { useRealTimeReports } from '../hooks/useRealTimeReports';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Button,
  Box,
  Alert,
  Stack,
  Card,
  Tabs,
  Tab,
  Autocomplete,
  TableContainer,
  CircularProgress,
  InputAdornment,
  useTheme,
  alpha,
  Divider,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  IconButton,
  Tooltip,
  Pagination,
  Backdrop,
  Fade,
  Badge,
  Snackbar
} from '@mui/material';
import {
  Search,
  Download,
  Refresh,
  FilterList,
  CalendarToday,
  Person,
  School,
  Receipt,
  Assessment,
  AccountBalance,
  Payment,
  AssignmentLate,
  TrendingUp,
  TrendingDown,
  ErrorOutline,
  CheckCircle,
  Warning,
  Info,
  Sync,
  WifiOff,
  Wifi
} from '@mui/icons-material';
import moment from 'moment';
import StatCard from '../components/StatCard';

const Reports = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { companyId } = useParams();
  
  // Redux selectors
  const { selectedCompany } = useSelector((state) => state.companies || {});
  const { token } = useSelector((state) => state.auth || {});
  const { students = [] } = useSelector((state) => state.students || {});
  const { teachers = [] } = useSelector((state) => state.teachers || {});
  const { courses = [] } = useSelector((state) => state.courses || {});
  const { batches = [] } = useSelector((state) => state.batches || {});
  
  // Fee reports selectors
  const feeCollectionReport = useSelector((state) => state.feeReports?.feeCollectionReport || {});
  const pendingFeesReport = useSelector((state) => state.feeReports?.pendingFeesReport || {});
  const studentLedgerReport = useSelector((state) => state.feeReports?.studentLedgerReport || {});
  const summaryReport = useSelector((state) => state.feeReports?.summaryReport || {});
  const voucherReport = useSelector((state) => state.feeReports?.voucherReport || {});
  const loading = useSelector((state) => state.feeReports?.loading || {});
  const errors = useSelector((state) => state.feeReports?.errors || {});

  const currentCompanyId = companyId || selectedCompany?._id;

  // State management — MUST be declared before any hooks that consume them
  const [tabValue, setTabValue] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showRealTimeStatus, setShowRealTimeStatus] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [filters, setFilters] = useState({
    startDate: moment().startOf('month').format('YYYY-MM-DD'),
    endDate: moment().endOf('month').format('YYYY-MM-DD'),
    studentId: '',
    courseId: '',
    batchId: '',
    status: '',
    overdueOnly: false,
    groupBy: 'day',
    includePending: true,
    page: 1,
    limit: 50
  });

  // Real-time reports hook
  const { 
    manualRefresh, 
    refreshAll, 
    getLastUpdate, 
    isConnected,
    isRealTimeEnabled 
  } = useRealTimeReports(currentCompanyId, tabValue, filters);

  // Initialize data
  useEffect(() => {
    if (currentCompanyId) {
      dispatch(getStudents({ companyId: currentCompanyId, limit: 1000 }));
      dispatch(getTeachers({ companyId: currentCompanyId, params: { limit: 1000, page: 1, search: '' } }));
      dispatch(getCourses({ companyId: currentCompanyId }));
      dispatch(getBatches({ companyId: currentCompanyId }));
    }
  }, [dispatch, currentCompanyId]);

  // Fetch report data based on active tab
  useEffect(() => {
    if (currentCompanyId) {
      fetchReportData();
    }
  }, [dispatch, currentCompanyId, tabValue, filters]);

  const fetchReportData = useCallback(() => {
    if (!currentCompanyId) return;

    const params = {
      companyId: currentCompanyId,
      ...filters,
      page: filters.page,
      limit: filters.limit
    };

    // Remove empty values
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    try {
      switch (tabValue) {
        case 0: // Fee Collection Report
          dispatch(fetchFeeCollectionReport(params));
          break;
        case 1: // Pending Fees Report
          dispatch(fetchPendingFeesReport(params));
          break;
        case 2: // Student Ledger Report
          if (selectedStudent) {
            dispatch(fetchStudentLedgerReport({ 
              companyId: currentCompanyId, 
              studentId: selectedStudent._id,
              ...params 
            }));
          }
          break;
        case 3: // Summary Report
          dispatch(fetchSummaryReport(params));
          break;
        case 4: // Voucher Report
          dispatch(fetchVoucherReport(params));
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    }
  }, [dispatch, currentCompanyId, tabValue, filters, selectedStudent]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: field === 'page' ? value : 1 // Reset page when changing filters
    }));
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // Clear errors when switching tabs
    const reportTypes = ['feeCollection', 'pendingFees', 'studentLedger', 'summary', 'vouchers'];
    if (reportTypes[newValue]) {
      dispatch(clearErrors({ reportType: reportTypes[newValue] }));
    }
  };

  const handleExport = (type) => {
    if (!currentCompanyId) return;

    let data = [];
    let columns = [];
    let title = '';
    let reportData;

    switch (tabValue) {
      case 0: // Fee Collection Report
        reportData = feeCollectionReport;
        title = 'Fee Collection Report';
        columns = [
          { header: 'Payment Date', key: 'paymentDate', width: 15 },
          { header: 'Payment #', key: 'paymentNumber', width: 15 },
          { header: 'Student', key: 'studentName', width: 25 },
          { header: 'Fee #', key: 'feeNumber', width: 15 },
          { header: 'Amount', key: 'amount', width: 15, format: 'currency', align: 'right' },
          { header: 'Method', key: 'paymentMethod', width: 12 },
          { header: 'Late Fee', key: 'lateFeeAmount', width: 12, format: 'currency', align: 'right' },
          { header: 'Discount', key: 'discountAmount', width: 12, format: 'currency', align: 'right' }
        ];
        data = reportData.payments?.map(payment => ({
          ...payment,
          studentName: payment.student?.name,
          feeNumber: payment.fee?.feeNumber,
          paymentDate: moment(payment.paymentDate).format('YYYY-MM-DD')
        })) || [];
        break;

      case 1: // Pending Fees Report
        reportData = pendingFeesReport;
        title = 'Pending Fees Report';
        columns = [
          { header: 'Fee #', key: 'feeNumber', width: 15 },
          { header: 'Student', key: 'studentName', width: 25 },
          { header: 'Roll Number', key: 'rollNumber', width: 15 },
          { header: 'Due Date', key: 'dueDate', width: 15 },
          { header: 'Total Amount', key: 'totalAmount', width: 15, format: 'currency', align: 'right' },
          { header: 'Paid Amount', key: 'paidAmount', width: 15, format: 'currency', align: 'right' },
          { header: 'Balance Due', key: 'balanceDue', width: 15, format: 'currency', align: 'right' },
          { header: 'Days Overdue', key: 'daysOverdue', width: 12, align: 'right' }
        ];
        data = reportData.pendingFees?.map(fee => ({
          ...fee,
          studentName: fee.student?.name,
          rollNumber: fee.student?.rollNumber,
          dueDate: moment(fee.dueDate).format('YYYY-MM-DD')
        })) || [];
        break;

      case 2: // Student Ledger Report
        if (!selectedStudent) return;
        reportData = studentLedgerReport;
        title = `Student Ledger - ${selectedStudent.name}`;
        columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Type', key: 'type', width: 12 },
          { header: 'Description', key: 'description', width: 40 },
          { header: 'Reference', key: 'reference', width: 15 },
          { header: 'Debit', key: 'debit', width: 15, format: 'currency', align: 'right' },
          { header: 'Credit', key: 'credit', width: 15, format: 'currency', align: 'right' },
          { header: 'Balance', key: 'balance', width: 15, format: 'currency', align: 'right' }
        ];
        data = reportData.transactions?.map(transaction => ({
          ...transaction,
          date: moment(transaction.date).format('YYYY-MM-DD')
        })) || [];
        break;

      case 3: // Summary Report
        reportData = summaryReport;
        title = 'Summary Report';
        columns = [
          { header: 'Period', key: 'period', width: 15 },
          { header: 'Total Fees', key: 'totalFees', width: 15, format: 'currency', align: 'right' },
          { header: 'Total Collected', key: 'totalCollected', width: 15, format: 'currency', align: 'right' },
          { header: 'Late Fee', key: 'totalLateFee', width: 12, format: 'currency', align: 'right' },
          { header: 'Discount', key: 'totalDiscount', width: 12, format: 'currency', align: 'right' },
          { header: 'Net Collection', key: 'netCollection', width: 15, format: 'currency', align: 'right' },
          { header: 'Pending', key: 'pendingAmount', width: 12, format: 'currency', align: 'right' }
        ];
        data = reportData.summary || [];
        break;

      case 4: // Voucher Report
        reportData = voucherReport;
        title = 'Voucher Report';
        columns = [
          { header: 'Voucher #', key: 'voucherNumber', width: 15 },
          { header: 'Student', key: 'studentName', width: 25 },
          { header: 'Created Date', key: 'createdAt', width: 15 },
          { header: 'Total Amount', key: 'totalAmount', width: 15, format: 'currency', align: 'right' },
          { header: 'Paid Amount', key: 'paidAmount', width: 15, format: 'currency', align: 'right' },
          { header: 'Balance Due', key: 'balanceDue', width: 15, format: 'currency', align: 'right' },
          { header: 'Status', key: 'status', width: 12 }
        ];
        data = reportData.vouchers?.map(voucher => ({
          ...voucher,
          studentName: voucher.student?.name,
          createdAt: moment(voucher.createdAt).format('YYYY-MM-DD')
        })) || [];
        break;

      default:
        return;
    }

    const reportDateRange = `${moment(filters.startDate).format('DD MMM YYYY')} - ${moment(filters.endDate).format('DD MMM YYYY')}`;
    
    if (type === 'excel') {
      exportToExcel(data, columns, title, reportDateRange, selectedCompany?.name, theme.palette.primary.main);
    } else {
      exportToPDF(data, columns, title, reportDateRange, selectedCompany?.name, theme.palette.primary.main);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'PKR 0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return theme.palette.success.main;
      case 'unpaid': return theme.palette.error.main;
      case 'partial': return theme.palette.warning.main;
      default: return theme.palette.grey[500];
    }
  };

  const getOverdueColor = (days) => {
    if (days <= 0) return theme.palette.success.main;
    if (days <= 30) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  // Loading and error states
  const currentLoading = loading[tabValue === 0 ? 'feeCollection' : 
                              tabValue === 1 ? 'pendingFees' : 
                              tabValue === 2 ? 'studentLedger' : 
                              tabValue === 3 ? 'summary' : 'vouchers'] || false;

  const currentError = errors[tabValue === 0 ? 'feeCollection' : 
                            tabValue === 1 ? 'pendingFees' : 
                            tabValue === 2 ? 'studentLedger' : 
                            tabValue === 3 ? 'summary' : 'vouchers'];

  if (!currentCompanyId) {
    return (
      <Container maxWidth={false} sx={{ mt: 4 }}>
        <Alert severity="info">Please select a company to view reports.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Fee Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Comprehensive fee management reports and analytics
            </Typography>
          </Box>
          
          {/* Real-time Status Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title={`Real-time updates ${isConnected ? 'enabled' : 'disabled'}`}>
              <Chip
                icon={isConnected ? <Wifi /> : <WifiOff />}
                label={isConnected ? 'Live' : 'Offline'}
                color={isConnected ? 'success' : 'default'}
                variant={isConnected ? 'filled' : 'outlined'}
                size="small"
                onClick={() => setShowRealTimeStatus(!showRealTimeStatus)}
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
            
            <Tooltip title="Refresh all reports">
              <IconButton 
                onClick={() => {
                  refreshAll();
                  setLastRefreshTime(moment());
                }}
                disabled={!isConnected}
                color="primary"
              >
                <Badge 
                  badgeContent={isConnected ? '' : '!'} 
                  color="error"
                  variant="dot"
                >
                  <Refresh />
                </Badge>
              </IconButton>
            </Tooltip>
            
            {lastRefreshTime && (
              <Typography variant="caption" color="text.secondary">
                Last: {moment(lastRefreshTime).fromNow()}
              </Typography>
            )}
          </Box>
        </Box>
        
        {/* Real-time Status Details */}
        {showRealTimeStatus && (
          <Alert 
            severity={isConnected ? 'success' : 'warning'}
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => setShowRealTimeStatus(false)}>
                Hide
              </Button>
            }
          >
            {isConnected ? (
              <Box>
                <Typography variant="body2">
                  <strong>Real-time updates active</strong> - Reports will automatically refresh when payments are recorded or fees are updated.
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Last updates: Fee Payments {getLastUpdate('fee-payment') ? moment(getLastUpdate('fee-payment')).fromNow() : 'Never'}, 
                  Fees {getLastUpdate('fee') ? moment(getLastUpdate('fee')).fromNow() : 'Never'}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2">
                Real-time updates are currently unavailable. Reports will only update when manually refreshed.
              </Typography>
            )}
          </Alert>
        )}
      </Box>

      {/* Filters Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          <FilterList sx={{ verticalAlign: 'middle', mr: 1 }} />
          Filters
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              options={students}
              getOptionLabel={(option) => `${option.name} (${option.rollNumber || 'N/A'})`}
              value={students.find(s => s._id === filters.studentId) || null}
              onChange={(event, newValue) => {
                handleFilterChange('studentId', newValue?._id || '');
                if (newValue) setSelectedStudent(newValue);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Student" />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              options={courses}
              getOptionLabel={(option) => option.name}
              value={courses.find(c => c._id === filters.courseId) || null}
              onChange={(event, newValue) => {
                handleFilterChange('courseId', newValue?._id || '');
              }}
              renderInput={(params) => (
                <TextField {...params} label="Course" />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              options={batches}
              getOptionLabel={(option) => option.name}
              value={batches.find(b => b._id === filters.batchId) || null}
              onChange={(event, newValue) => {
                handleFilterChange('batchId', newValue?._id || '');
              }}
              renderInput={(params) => (
                <TextField {...params} label="Batch" />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => fetchReportData()}
              disabled={currentLoading}
              sx={{ height: '56px' }}
            >
              Refresh
            </Button>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Download />}
                onClick={() => handleExport('excel')}
                disabled={currentLoading}
              >
                Excel
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Download />}
                onClick={() => handleExport('pdf')}
                disabled={currentLoading}
              >
                PDF
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper elevation={2} sx={{ borderRadius: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            '& .MuiTab-root': { 
              minHeight: 64,
              fontWeight: 600
            }
          }}
        >
          <Tab icon={<Payment />} label="Fee Collection" />
          <Tab icon={<AssignmentLate />} label="Pending Fees" />
          <Tab icon={<Person />} label="Student Ledger" />
          <Tab icon={<Assessment />} label="Summary" />
          <Tab icon={<Receipt />} label="Vouchers" />
        </Tabs>

        {/* Error Display */}
        {currentError && (
          <Alert 
            severity="error" 
            sx={{ m: 3 }}
            action={
              <Button size="small" onClick={() => dispatch(clearErrors({ reportType: tabValue === 0 ? 'feeCollection' : tabValue === 1 ? 'pendingFees' : tabValue === 2 ? 'studentLedger' : tabValue === 3 ? 'summary' : 'vouchers' }))}>
                Clear
              </Button>
            }
          >
            {currentError}
          </Alert>
        )}

        {/* Loading Overlay */}
        <Backdrop open={currentLoading} sx={{ position: 'absolute', zIndex: 1 }}>
          <Fade in={currentLoading}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={60} />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Loading report data...
              </Typography>
            </Box>
          </Fade>
        </Backdrop>

        {/* Tab Content */}
        <Box sx={{ p: 3, position: 'relative' }}>
          {/* TAB 0: Fee Collection Report */}
          {tabValue === 0 && (
            <Box>
              {/* Summary Cards */}
              {feeCollectionReport.summary && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Collection"
                      value={formatCurrency(feeCollectionReport.summary.netCollection)}
                      icon={<TrendingUp />}
                      color={theme.palette.success.main}
                      subtitle="Net amount collected"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Payments"
                      value={feeCollectionReport.summary.totalPayments || 0}
                      icon={<Payment />}
                      color={theme.palette.primary.main}
                      subtitle="Number of payments"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Late Fee Collected"
                      value={formatCurrency(feeCollectionReport.summary.totalLateFee)}
                      icon={<Warning />}
                      color={theme.palette.warning.main}
                      subtitle="Late fee charges"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Discount Given"
                      value={formatCurrency(feeCollectionReport.summary.totalDiscount)}
                      icon={<TrendingDown />}
                      color={theme.palette.info.main}
                      subtitle="Total discounts"
                    />
                  </Grid>
                </Grid>
              )}

              {/* Payments Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.07) }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Payment Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Payment #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Voucher / Fee #</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount (PKR)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Method</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Late Fee</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Discount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(feeCollectionReport.payments?.length === 0 || !feeCollectionReport.payments) ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                          No payments found. Adjust filters and click Refresh.
                        </TableCell>
                      </TableRow>
                    ) : feeCollectionReport.payments?.map((payment) => (
                      <TableRow key={payment._id} hover>
                        <TableCell>{moment(payment.paymentDate).format('DD MMM YYYY')}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{payment.paymentNumber}</TableCell>
                        <TableCell>{payment.student?.name}</TableCell>
                        <TableCell>{payment.voucher?.voucherNumber || payment.fee?.feeNumber || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <Chip label={payment.paymentMethod || 'Cash'} size="small"
                            color={payment.paymentMethod === 'Bank' || payment.paymentMethod === 'Online' ? 'primary' : 'default'}
                            variant="outlined" sx={{ fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ color: payment.lateFeeAmount > 0 ? 'warning.main' : 'text.disabled' }}>{payment.lateFeeAmount > 0 ? formatCurrency(payment.lateFeeAmount) : '—'}</TableCell>
                        <TableCell align="right" sx={{ color: payment.discountAmount > 0 ? 'info.main' : 'text.disabled' }}>{payment.discountAmount > 0 ? formatCurrency(payment.discountAmount) : '—'}</TableCell>
                      </TableRow>
                    ))}
                    {feeCollectionReport.summary && feeCollectionReport.payments?.length > 0 && (
                      <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.06), borderTop: '2px solid #ccc' }}>
                        <TableCell colSpan={4} sx={{ fontWeight: 800 }}>TOTAL ({feeCollectionReport.summary.totalPayments} payments)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: 'success.dark' }}>{formatCurrency(feeCollectionReport.summary.totalAmount)}</TableCell>
                        <TableCell />
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.main' }}>{formatCurrency(feeCollectionReport.summary.totalLateFee)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'info.main' }}>{formatCurrency(feeCollectionReport.summary.totalDiscount)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {feeCollectionReport.pagination && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={feeCollectionReport.pagination.pages}
                    page={feeCollectionReport.pagination.page}
                    onChange={(event, page) => handleFilterChange('page', page)}
                    color="primary"
                  />
                </Box>
              )}
            </Box>
          )}

          {/* TAB 1: Pending Fees Report */}
          {tabValue === 1 && (
            <Box>
              {/* Summary Cards */}
              {pendingFeesReport.summary && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Pending"
                      value={formatCurrency(pendingFeesReport.summary.totalPending)}
                      icon={<AssignmentLate />}
                      color={theme.palette.error.main}
                      subtitle="Outstanding amount"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Overdue Amount"
                      value={formatCurrency(pendingFeesReport.summary.overdueAmount)}
                      icon={<Warning />}
                      color={theme.palette.warning.main}
                      subtitle="Past due date"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Overdue Count"
                      value={pendingFeesReport.summary.overdueCount || 0}
                      icon={<ErrorOutline />}
                      color={theme.palette.warning.main}
                      subtitle="Students overdue"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Overdue %"
                      value={`${(pendingFeesReport.summary.overduePercentage || 0).toFixed(1)}%`}
                      icon={<Assessment />}
                      color={theme.palette.info.main}
                      subtitle="Of total fees"
                    />
                  </Grid>
                </Grid>
              )}

              {/* Pending Fees Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.07) }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Fee #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Roll Number</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Due Date</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Paid Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Balance Due</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Days Overdue</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(pendingFeesReport.pendingFees?.length === 0 || !pendingFeesReport.pendingFees) ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                          No pending fees. All fees are settled!
                        </TableCell>
                      </TableRow>
                    ) : pendingFeesReport.pendingFees?.map((fee) => (
                      <TableRow key={fee._id} hover>
                        <TableCell>{fee.feeNumber}</TableCell>
                        <TableCell>{fee.student?.name}</TableCell>
                        <TableCell>{fee.student?.rollNumber}</TableCell>
                        <TableCell>{moment(fee.dueDate).format('DD-MM-YYYY')}</TableCell>
                        <TableCell align="right">{formatCurrency(fee.totalAmount)}</TableCell>
                        <TableCell align="right">{formatCurrency(fee.paidAmount)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: fee.balanceDue > 0 ? 'error.main' : 'success.main' }}>
                          {formatCurrency(fee.balanceDue)}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={fee.daysOverdue}
                            size="small"
                            sx={{
                              backgroundColor: alpha(getOverdueColor(fee.daysOverdue), 0.1),
                              color: getOverdueColor(fee.daysOverdue),
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={fee.status}
                            size="small"
                            sx={{
                              backgroundColor: alpha(getStatusColor(fee.status), 0.1),
                              color: getStatusColor(fee.status),
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {pendingFeesReport.pagination && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={pendingFeesReport.pagination.pages}
                    page={pendingFeesReport.pagination.page}
                    onChange={(event, page) => handleFilterChange('page', page)}
                    color="primary"
                  />
                </Box>
              )}
            </Box>
          )}

          {/* TAB 2: Student Ledger Report */}
          {tabValue === 2 && (
            <Box>
              {!selectedStudent ? (
                <Alert severity="info">
                  Please select a student to view their ledger report.
                </Alert>
              ) : (
                <>
                  {/* Student Info */}
                  {studentLedgerReport.student && (
                    <Card sx={{ mb: 3, p: 3, backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                      <Typography variant="h6" gutterBottom>
                        Student Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Name</Typography>
                          <Typography variant="body1" fontWeight="bold">{studentLedgerReport.student.name}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Roll Number</Typography>
                          <Typography variant="body1" fontWeight="bold">{studentLedgerReport.student.rollNumber}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Contact</Typography>
                          <Typography variant="body1" fontWeight="bold">{studentLedgerReport.student.contact}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Email</Typography>
                          <Typography variant="body1" fontWeight="bold">{studentLedgerReport.student.email}</Typography>
                        </Grid>
                      </Grid>
                    </Card>
                  )}

                  {/* Summary Cards */}
                  {studentLedgerReport.summary && (
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                      <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                          title="Total Fees"
                          value={formatCurrency(studentLedgerReport.summary.totalFees)}
                          icon={<Receipt />}
                          color={theme.palette.primary.main}
                          subtitle="Total fee amount"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                          title="Total Paid"
                          value={formatCurrency(studentLedgerReport.summary.totalPaid)}
                          icon={<Payment />}
                          color={theme.palette.success.main}
                          subtitle="Amount paid"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                          title="Balance Due"
                          value={formatCurrency(studentLedgerReport.summary.totalPending)}
                          icon={<AssignmentLate />}
                          color={theme.palette.error.main}
                          subtitle="Outstanding amount"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                          title="Transactions"
                          value={(studentLedgerReport.summary.feeCount || 0) + (studentLedgerReport.summary.paymentCount || 0)}
                          icon={<Assessment />}
                          color={theme.palette.info.main}
                          subtitle="Total transactions"
                        />
                      </Grid>
                    </Grid>
                  )}

                  {/* Transactions Table */}
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Reference</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Debit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Credit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {studentLedgerReport.transactions?.map((transaction, index) => (
                          <TableRow key={index} hover>
                            <TableCell>{moment(transaction.date).format('DD-MM-YYYY')}</TableCell>
                            <TableCell>
                              <Chip
                                label={transaction.type}
                                size="small"
                                color={transaction.type === 'fee' ? 'error' : 'success'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>{transaction.reference}</TableCell>
                            <TableCell align="right">
                              {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                            </TableCell>
                            <TableCell align="right">
                              {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(transaction.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          )}

          {/* TAB 3: Summary Report */}
          {tabValue === 3 && (
            <Box>
              {/* Summary Controls */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Group By</InputLabel>
                    <Select
                      value={filters.groupBy}
                      onChange={(e) => handleFilterChange('groupBy', e.target.value)}
                      label="Group By"
                    >
                      <MenuItem value="day">Day</MenuItem>
                      <MenuItem value="week">Week</MenuItem>
                      <MenuItem value="month">Month</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => handleFilterChange('includePending', !filters.includePending)}
                    sx={{ height: '56px' }}
                  >
                    {filters.includePending ? 'Include Pending' : 'Exclude Pending'}
                  </Button>
                </Grid>
              </Grid>

              {/* Total Summary Cards */}
              {summaryReport.totals && (() => {
                const eff = summaryReport.totals.totalFees > 0
                  ? ((summaryReport.totals.totalCollected / summaryReport.totals.totalFees) * 100).toFixed(1)
                  : 0;
                return (
                  <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard
                        title="Total Fees Raised"
                        value={formatCurrency(summaryReport.totals.totalFees)}
                        icon={<Receipt />}
                        color={theme.palette.primary.main}
                        subtitle={`${summaryReport.totals.totalFeeCount} invoices`}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard
                        title="Total Collected"
                        value={formatCurrency(summaryReport.totals.totalCollected)}
                        icon={<TrendingUp />}
                        color={theme.palette.success.main}
                        subtitle={`${summaryReport.totals.totalPaymentCount} receipts`}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard
                        title="Net Collection"
                        value={formatCurrency(summaryReport.totals.netCollection)}
                        icon={<AccountBalance />}
                        color={theme.palette.info.main}
                        subtitle="After discounts"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard
                        title="Outstanding"
                        value={formatCurrency(summaryReport.totals.totalPending)}
                        icon={<AssignmentLate />}
                        color={theme.palette.error.main}
                        subtitle="Balance receivable"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard
                        title="Late Fee Income"
                        value={formatCurrency(summaryReport.totals.totalLateFee)}
                        icon={<Warning />}
                        color={theme.palette.warning.main}
                        subtitle="Late fee charges"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                      <StatCard
                        title="Collection Efficiency"
                        value={`${eff}%`}
                        icon={<Assessment />}
                        color={Number(eff) >= 80 ? theme.palette.success.main : Number(eff) >= 50 ? theme.palette.warning.main : theme.palette.error.main}
                        subtitle={Number(eff) >= 80 ? 'Excellent' : Number(eff) >= 50 ? 'Moderate' : 'Needs attention'}
                      />
                    </Grid>
                  </Grid>
                );
              })()}

              {/* Summary Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Period</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Fees</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Collected</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Late Fee</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Discount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Net Collection</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Pending</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!summaryReport.summary?.length ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                          No summary data. Adjust date range and click Refresh.
                        </TableCell>
                      </TableRow>
                    ) : summaryReport.summary?.map((row, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{row.period}</TableCell>
                        <TableCell align="right">{formatCurrency(row.totalFees)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.totalCollected)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.totalLateFee)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.totalDiscount)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.netCollection)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.pendingAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* TAB 4: Voucher Report */}
          {tabValue === 4 && (
            <Box>
              {/* Summary Cards */}
              {voucherReport.summary && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Total Vouchers"
                      value={voucherReport.summary.totalVouchers || 0}
                      icon={<Receipt />}
                      color={theme.palette.primary.main}
                      subtitle="All vouchers"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Paid Vouchers"
                      value={voucherReport.summary.paidVouchers || 0}
                      icon={<CheckCircle />}
                      color={theme.palette.success.main}
                      subtitle="Fully paid"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Partial Vouchers"
                      value={voucherReport.summary.partialVouchers || 0}
                      icon={<Warning />}
                      color={theme.palette.warning.main}
                      subtitle="Partially paid"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                      title="Unpaid Vouchers"
                      value={voucherReport.summary.unpaidVouchers || 0}
                      icon={<ErrorOutline />}
                      color={theme.palette.error.main}
                      subtitle="Not paid"
                    />
                  </Grid>
                </Grid>
              )}

              {/* Vouchers Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.07) }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Voucher #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Due Date</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total (PKR)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Paid (PKR)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Balance (PKR)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Collection %</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(voucherReport.vouchers?.length === 0 || !voucherReport.vouchers) ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                          No vouchers found. Adjust date range and click Refresh.
                        </TableCell>
                      </TableRow>
                    ) : voucherReport.vouchers?.map((voucher) => {
                      const collPct = voucher.totalAmount > 0 ? Math.min(100, ((voucher.paidAmount || 0) / voucher.totalAmount) * 100).toFixed(0) : 0;
                      return (
                        <TableRow key={voucher._id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{voucher.voucherNumber}</TableCell>
                          <TableCell>{voucher.student?.name}</TableCell>
                          <TableCell sx={{ color: voucher.dueDate && new Date(voucher.dueDate) < new Date() && voucher.status !== 'paid' ? 'error.main' : 'text.primary' }}>
                            {voucher.dueDate ? moment(voucher.dueDate).format('DD MMM YYYY') : '—'}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(voucher.totalAmount)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(voucher.paidAmount || 0)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: voucher.balanceDue > 0 ? 'error.main' : 'success.main' }}>
                            {formatCurrency(voucher.balanceDue)}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ flex: 1, bgcolor: 'grey.200', borderRadius: 1, height: 6 }}>
                                <Box sx={{ width: `${collPct}%`, bgcolor: Number(collPct) === 100 ? 'success.main' : Number(collPct) > 0 ? 'warning.main' : 'error.main', height: 6, borderRadius: 1 }} />
                              </Box>
                              <Typography variant="caption" fontWeight={700}>{collPct}%</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={voucher.status}
                              size="small"
                              sx={{
                                backgroundColor: alpha(getStatusColor(voucher.status), 0.1),
                                color: getStatusColor(voucher.status),
                                fontWeight: 'bold',
                                textTransform: 'capitalize'
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {voucherReport.summary && voucherReport.vouchers?.length > 0 && (
                      <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06), borderTop: '2px solid #ccc' }}>
                        <TableCell colSpan={3} sx={{ fontWeight: 800 }}>TOTAL ({voucherReport.summary.totalVouchers} vouchers)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(voucherReport.summary.totalAmount)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>{formatCurrency(voucherReport.summary.totalPaid)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main' }}>{formatCurrency(voucherReport.summary.totalPending)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {voucherReport.pagination && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={voucherReport.pagination.pages}
                    page={voucherReport.pagination.page}
                    onChange={(event, page) => handleFilterChange('page', page)}
                    color="primary"
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default Reports;
