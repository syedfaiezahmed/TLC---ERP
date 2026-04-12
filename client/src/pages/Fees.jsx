import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getFees, deleteFee, recordPayment } from '../redux/feeSlice';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Chip,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  useTheme,
  alpha,
  Tooltip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TablePagination
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaidIcon from '@mui/icons-material/Paid';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import moment from 'moment';
import { toast } from 'react-toastify';
import StatCard from '../components/StatCard';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const StatusChip = ({ status, dueDate }) => {
    const theme = useTheme();
    const isOverdue = status !== 'paid' && moment(dueDate).isBefore(moment(), 'day');
    
    let label = status.toUpperCase();
    let bgcolor = theme.palette.grey[100];
    let textColor = theme.palette.grey[700];

    if (status === 'paid') {
        bgcolor = alpha(theme.palette.success.main, 0.1);
        textColor = theme.palette.success.dark;
    } else if (status === 'partial') {
        bgcolor = alpha(theme.palette.warning.main, 0.1);
        textColor = theme.palette.warning.dark;
    } else if (isOverdue) {
        label = 'OVERDUE';
        bgcolor = alpha(theme.palette.error.main, 0.1);
        textColor = theme.palette.error.dark;
    } else {
        bgcolor = alpha(theme.palette.info.main, 0.1);
        textColor = theme.palette.info.dark;
    }

    return (
        <Chip 
            label={label} 
            size="small" 
            sx={{ 
                bgcolor: bgcolor, 
                color: textColor,
                fontWeight: 700,
                borderRadius: 1,
                border: 'none',
                px: 1,
                height: 24,
                fontSize: '0.75rem'
            }} 
        />
    );
};

const Fees = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId } = useParams();
  const { fees, summary, total } = useSelector((state) => state.fees);
  const { selectedCompany } = useSelector((state) => state.companies);
  const currentCompanyId = companyId || selectedCompany?._id;
  const theme = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
      start: moment().startOf('month').format('YYYY-MM-DD'),
      end: moment().endOf('month').format('YYYY-MM-DD')
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState(null);
  const [paymentData, setPaymentData] = useState({
      amount: '',
      date: moment().format('YYYY-MM-DD'),
      method: 'Cash',
      reference: '',
      notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFeesData = useCallback(() => {
      if (!currentCompanyId) return;
      
      dispatch(getFees({
          companyId: currentCompanyId,
          page: page + 1, 
          limit: rowsPerPage,
          search: searchTerm,
          status: statusFilter === 'all' ? '' : statusFilter,
          startDate: dateRange.start,
          endDate: dateRange.end
      }));
  }, [dispatch, currentCompanyId, page, rowsPerPage, searchTerm, statusFilter, dateRange]);

  useEffect(() => {
      fetchFeesData();

      const interval = setInterval(() => {
          if (navigator.onLine && document.visibilityState === 'visible') {
              fetchFeesData();
          }
      }, 10000);

      return () => clearInterval(interval);
  }, [fetchFeesData]);

  const handleChangePage = (event, newPage) => {
      setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this fee record?')) {
      dispatch(deleteFee(id));
      toast.success('Fee record deleted successfully');
    }
  };

  const handlePaymentSubmit = async () => {
      if (!selectedFeeForPayment) return;
      if (!paymentData.amount || paymentData.amount <= 0) {
          toast.error("Please enter a valid amount");
          return;
      }
      
      setIsSubmitting(true);
      try {
          const result = await dispatch(recordPayment({ 
              id: selectedFeeForPayment._id, 
              paymentData: { ...paymentData, amount: Number(paymentData.amount) } 
          }));

          if (!result.error) {
              setOpenPaymentDialog(false);
              setSelectedFeeForPayment(null);
              dispatch(getFees({
                  companyId: currentCompanyId,
                  search: searchTerm,
                  status: statusFilter === 'all' ? '' : statusFilter,
                  startDate: dateRange.start,
                  endDate: dateRange.end
              }));
          } else {
              toast.error(result.payload?.message || "Payment failed");
          }
      } catch (error) {
          console.error("Payment error:", error);
          toast.error("An unexpected error occurred.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const filteredFees = useMemo(() => {
      return fees || [];
  }, [fees]);

  if (!currentCompanyId) {
      return (
          <Box p={3}>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>Please select an institute from the Dashboard first.</Alert>
          </Box>
      )
  }

  const handleExport = (type) => {
      const columns = [
          { header: 'Fee #', key: 'feeNumber', width: 15 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Student', key: 'student', width: 25 },
          { header: 'Due Date', key: 'dueDate', width: 15 },
          { header: 'Total', key: 'total', width: 15, format: 'currency', align: 'right', sum: true },
          { header: 'Paid', key: 'paid', width: 15, format: 'currency', align: 'right', sum: true },
          { header: 'Balance', key: 'balance', width: 15, format: 'currency', align: 'right', sum: true },
          { header: 'Status', key: 'status', width: 15 }
      ];
      const title = 'Fee Receipt List';
      const reportDateRange = `${moment(dateRange.start).format('DD MMM YYYY')} - ${moment(dateRange.end).format('DD MMM YYYY')}`;
      
      const data = filteredFees.map(f => ({
          feeNumber: f.feeNumber,
          date: moment(f.date).format('YYYY-MM-DD'),
          student: f.student ? f.student.name : 'Unknown',
          dueDate: f.dueDate ? moment(f.dueDate).format('YYYY-MM-DD') : '-',
          total: f.totalAmount,
          paid: f.paidAmount || 0,
          balance: f.balanceDue !== undefined ? f.balanceDue : (f.totalAmount - (f.paidAmount || 0)),
          status: f.status.toUpperCase()
      }));

      if (type === 'excel') {
          exportToExcel(data, columns, title, reportDateRange, selectedCompany?.name, theme.palette.primary.main);
      } else {
          exportToPDF(data, columns, title, reportDateRange, selectedCompany?.name, theme.palette.primary.main);
      }
  };

  const handleRefresh = () => {
      fetchFeesData();
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* Header */}
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={2} gap={2}>
          <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5 }}>
                Fee Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage student fee receipts and payments for {selectedCompany?.name || 'Institute'}
              </Typography>
          </Box>
          <Box display="flex" gap={2} width={{ xs: '100%', md: 'auto' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width={{ xs: '100%', md: 'auto' }} justifyContent={{ xs: 'space-between', md: 'flex-start' }}>
                <Button 
                    variant="outlined" 
                    startIcon={<DownloadIcon />} 
                    onClick={() => handleExport('excel')}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#1D6F42', borderColor: '#1D6F42', flex: { xs: 1, sm: 'none' } }}
                >
                    Excel
                </Button>
                <Button 
                    variant="outlined" 
                    startIcon={<DownloadIcon />} 
                    onClick={() => handleExport('pdf')}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#D32F2F', borderColor: '#D32F2F', flex: { xs: 1, sm: 'none' } }}
                >
                    PDF
                </Button>
                <Button 
                    variant="outlined" 
                    size="medium"
                    startIcon={<RefreshIcon />} 
                    onClick={handleRefresh}
                    sx={{ 
                        borderRadius: 2, 
                        textTransform: 'none',
                        fontWeight: 600,
                        color: 'text.secondary',
                        borderColor: 'divider',
                        flex: { xs: 1, sm: 'none' },
                        '&:hover': {
                            bgcolor: 'action.hover',
                            borderColor: 'text.secondary'
                        }
                    }}
                >
                    Refresh
                </Button>
                <Button 
                    variant="contained" 
                    size="medium"
                    startIcon={<AddIcon />} 
                    onClick={() => navigate(`/company/${companyId}/fees/create`)}
                    sx={{ 
                        px: 3, 
                        py: 1,
                        borderRadius: 2, 
                        boxShadow: 'none',
                        bgcolor: 'primary.main',
                        flex: { xs: 1, sm: 'none' },
                        '&:hover': {
                            bgcolor: 'primary.dark',
                            boxShadow: 'none'
                        }
                    }}
                >
                    Create Fee Receipt
                </Button>
            </Stack>
          </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={4}>
              <StatCard 
                  title="Total Fee Billed" 
                  value={`PKR ${summary?.totalInvoiced?.toLocaleString() || '0'}`} 
                  icon={<ReceiptLongIcon fontSize="medium" />} 
                  color={theme.palette.primary.main} 
              />
          </Grid>
          <Grid item xs={12} md={4}>
              <StatCard 
                  title="Total Collected" 
                  value={`PKR ${summary?.totalPaid?.toLocaleString() || '0'}`} 
                  icon={<PaidIcon fontSize="medium" />} 
                  color={theme.palette.success.main} 
              />
          </Grid>
          <Grid item xs={12} md={4}>
              <StatCard 
                  title="Total Outstanding" 
                  value={`PKR ${summary?.totalDue?.toLocaleString() || '0'}`} 
                  icon={<PendingActionsIcon fontSize="medium" />} 
                  color={theme.palette.error.main} 
              />
          </Grid>
      </Grid>

      {/* Filters & Controls */}
      <Card sx={{ mb: 3, borderRadius: 4, overflow: 'visible', border: 'none', boxShadow: theme.shadows[1] }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                  <TextField
                      fullWidth
                      size="small"
                      placeholder="Search Fee # or Student..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                          startAdornment: (
                              <InputAdornment position="start">
                                  <SearchIcon color="action" fontSize="small" />
                              </InputAdornment>
                          ),
                          sx: { borderRadius: 2, bgcolor: 'background.default' }
                      }}
                      variant="outlined"
                  />
              </Grid>
              <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                      <InputLabel>Status Filter</InputLabel>
                      <Select
                          value={statusFilter}
                          label="Status Filter"
                          onChange={(e) => setStatusFilter(e.target.value)}
                          sx={{ borderRadius: 2 }}
                      >
                          <MenuItem value="all">All Statuses</MenuItem>
                          <MenuItem value="paid">Paid</MenuItem>
                          <MenuItem value="partial">Partial</MenuItem>
                          <MenuItem value="sent">Unpaid</MenuItem>
                          <MenuItem value="overdue">Overdue</MenuItem>
                      </Select>
                  </FormControl>
              </Grid>
              <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={2} alignItems="center">
                      <TextField
                          label="From Date"
                          type="date"
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          value={dateRange.start}
                          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                          fullWidth
                          InputProps={{ sx: { borderRadius: 2 } }}
                      />
                      <Typography color="text.secondary">-</Typography>
                      <TextField
                          label="To Date"
                          type="date"
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          value={dateRange.end}
                          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                          fullWidth
                          InputProps={{ sx: { borderRadius: 2 } }}
                      />
                  </Stack>
              </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Fees Table */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, overflowX: 'auto', boxShadow: theme.shadows[2] }}>
        <Table sx={{ minWidth: 800 }} size="small">
          <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Receipt</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none', display: { xs: 'none', md: 'table-cell' } }}>Student</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none', display: { xs: 'none', md: 'table-cell' } }}>Due Date</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Total</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Balance</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFees.length > 0 ? (
                filteredFees.map((fee) => (
                  <TableRow 
                    key={fee._id} 
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 }, transition: 'background-color 0.2s' }}
                  >
                    <TableCell sx={{ py: 1 }}>
                        <Box>
                            <Typography variant="body2" fontWeight={700} color="primary.main">
                                #{fee.feeNumber}
                            </Typography>
                            <Typography variant="caption" color="text.primary" sx={{ display: { xs: 'block', md: 'none' }, fontWeight: 600 }}>
                                {fee.student?.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {moment(fee.date).format('MMM DD, YYYY')}
                            </Typography>
                        </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1, display: { xs: 'none', md: 'table-cell' } }}>
                        <Typography variant="body2" fontWeight={500} color="text.primary">
                            {fee.student?.name || 'N/A'}
                        </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1, display: { xs: 'none', md: 'table-cell' } }}>
                        {fee.dueDate ? (
                            <Typography 
                                variant="body2" 
                                color={moment(fee.dueDate).isBefore(moment(), 'day') && fee.status !== 'paid' ? 'error.main' : 'text.primary'}
                                fontWeight={moment(fee.dueDate).isBefore(moment(), 'day') && fee.status !== 'paid' ? 600 : 400}
                            >
                                {moment(fee.dueDate).format('MMM DD, YYYY')}
                            </Typography>
                        ) : '-'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>PKR {fee.totalAmount.toFixed(2)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 500, py: 1 }}>
                        PKR {(fee.balanceDue !== undefined ? fee.balanceDue : (fee.totalAmount - (fee.paidAmount || 0))).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                        <StatusChip status={fee.status} dueDate={fee.dueDate} />
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1 }}>
                      <Box display="flex" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title="View Receipt">
                            <IconButton 
                                onClick={() => navigate(`/company/${currentCompanyId}/fees/${fee._id}/preview`)} 
                                size="small" 
                                sx={{ 
                                    color: theme.palette.info.main, 
                                    bgcolor: alpha(theme.palette.info.main, 0.1), 
                                    borderRadius: 1.5, 
                                    padding: 0.5,
                                    '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.2) } 
                                }}
                            >
                              <VisibilityIcon fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Receipt">
                            <IconButton 
                                onClick={() => navigate(`/company/${currentCompanyId}/fees/edit/${fee._id}`)} 
                                size="small" 
                                sx={{ 
                                    color: theme.palette.primary.main, 
                                    bgcolor: alpha(theme.palette.primary.main, 0.1), 
                                    borderRadius: 1.5, 
                                    padding: 0.5,
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } 
                                }}
                            >
                              <EditIcon fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Receipt">
                            <IconButton 
                                onClick={() => handleDelete(fee._id)} 
                                size="small" 
                                sx={{ 
                                    color: theme.palette.error.main, 
                                    bgcolor: alpha(theme.palette.error.main, 0.1), 
                                    borderRadius: 1.5, 
                                    padding: 0.5,
                                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } 
                                }}
                            >
                              <DeleteIcon fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Fee Refund">
                            <IconButton 
                                onClick={() => navigate(`/company/${currentCompanyId}/fee-refunds`)} 
                                size="small" 
                                sx={{ 
                                    color: theme.palette.warning.main, 
                                    bgcolor: alpha(theme.palette.warning.main, 0.1), 
                                    borderRadius: 1.5, 
                                    padding: 0.5,
                                    '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) } 
                                }}
                            >
                              <ReceiptLongIcon fontSize="small" sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
            ) : (
                <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                            <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
                            <Typography variant="subtitle1" color="text.secondary" gutterBottom>No fee receipts found</Typography>
                            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>Try adjusting your filters or search criteria.</Typography>
                        </Box>
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 20, 50, 100]}
        component="div"
        count={total || 0}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
      <Dialog open={openPaymentDialog} onClose={() => setOpenPaymentDialog(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Record Fee Payment</DialogTitle>
        <DialogContent dividers>
            <DialogContentText sx={{ mb: 2 }}>
                Record a payment for Fee Receipt <strong>#{selectedFeeForPayment?.feeNumber}</strong> for Student <strong>{selectedFeeForPayment?.student?.name}</strong>.
            </DialogContentText>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Date"
                        type="date"
                        fullWidth
                        value={paymentData.date}
                        onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Amount"
                        type="number"
                        fullWidth
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">PKR</InputAdornment>
                        }}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                        <InputLabel>Payment Method</InputLabel>
                        <Select
                            value={paymentData.method}
                            label="Payment Method"
                            onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                        >
                            <MenuItem value="Cash">Cash</MenuItem>
                            <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                            <MenuItem value="Cheque">Cheque</MenuItem>
                            <MenuItem value="Online">Online</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Reference #"
                        fullWidth
                        value={paymentData.reference}
                        onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        label="Notes"
                        fullWidth
                        multiline
                        rows={2}
                        value={paymentData.notes}
                        onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    />
                </Grid>
            </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setOpenPaymentDialog(false)} color="inherit" size="large" disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handlePaymentSubmit} variant="contained" color="success" size="large" sx={{ borderRadius: 2, px: 4 }} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Record Payment'}
            </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Fees;
