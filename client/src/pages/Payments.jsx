import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { getPaymentsReport } from '../redux/reportSlice';
import { recordPayment, recordGenericPayment } from '../redux/feeSlice'; 
import { fetchFees, deletePayment, getPaymentDetails } from '../services/api';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  IconButton,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import moment from 'moment';
import StatCard from '../components/StatCard';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

import { getStudents } from '../redux/studentSlice';

const Payments = () => {
  const dispatch = useDispatch();
  const { companyId } = useParams();
  const theme = useTheme();
  const { paymentsReport, loading } = useSelector((state) => state.reports);
  const { selectedCompany } = useSelector((state) => state.companies);
  const { students } = useSelector((state) => state.students);
  
  const currentCompanyId = companyId || selectedCompany?._id;

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
      startDate: moment().startOf('month').format('YYYY-MM-DD'),
      endDate: moment().endOf('month').format('YYYY-MM-DD')
  });

  const [openReceiveDialog, setOpenReceiveDialog] = useState(false);
  const [receiveData, setReceiveData] = useState({
      studentId: null,
      fee: null,
      amount: '',
      discount: '',
      date: moment().format('YYYY-MM-DD'),
      method: 'Cash',
      reference: '',
      notes: ''
  });

  const [studentFees, setStudentFees] = useState([]);
  const [allUnpaidFees, setAllUnpaidFees] = useState([]); 
  const [loadingFees, setLoadingFees] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const fetchPayments = useCallback(() => {
      dispatch(getPaymentsReport({
          companyId: currentCompanyId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
      }));
  }, [dispatch, currentCompanyId, dateRange]);

  useEffect(() => {
    if (currentCompanyId) {
        fetchPayments();
    }
  }, [currentCompanyId, fetchPayments]);

  useEffect(() => {
    if (currentCompanyId) {
        dispatch(getStudents({ companyId: currentCompanyId })); 

        const fetchAllUnpaidFees = async () => {
            setLoadingFees(true);
            try {
                const { data } = await fetchFees(currentCompanyId, 1, 1000, '', 'unpaid,partial', '', '', '');
                setAllUnpaidFees(data.fees || []);
            } catch (error) {
                console.error("Failed to fetch fees", error);
            } finally {
                setLoadingFees(false);
            }
        };
        fetchAllUnpaidFees();
    }
  }, [dispatch, currentCompanyId]);

  useEffect(() => {
      if (receiveData.studentId && allUnpaidFees.length > 0) {
          const filtered = allUnpaidFees.filter(fee => 
              fee.student && (fee.student._id === receiveData.studentId._id || fee.student === receiveData.studentId._id)
          );
          setStudentFees(filtered);
      } else {
          setStudentFees([]);
      }
  }, [receiveData.studentId, allUnpaidFees]);

  useEffect(() => {
      if (receiveData.fee) {
          setReceiveData(prev => ({
              ...prev,
              amount: receiveData.fee.balanceDue || (receiveData.fee.totalAmount - (receiveData.fee.paidAmount || 0))
          }));
      }
  }, [receiveData.fee]);

  const filteredPayments = useMemo(() => {
      if (!paymentsReport || !Array.isArray(paymentsReport)) return [];
      
      let data = [...paymentsReport];

      if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          data = data.filter(item => 
              item && (
                  (item.description && item.description.toLowerCase().includes(lowerSearch)) ||
                  (item.student && item.student.name && item.student.name.toLowerCase().includes(lowerSearch)) ||
                  (item.reference && item.reference.toLowerCase().includes(lowerSearch))
              )
          );
      }
      
      return data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [paymentsReport, searchTerm]);

  const totalReceived = useMemo(() => {
      return filteredPayments.reduce((sum, item) => sum + (item.cashReceived || 0), 0);
  }, [filteredPayments]);

  const totalDiscount = useMemo(() => {
      return filteredPayments.reduce((sum, item) => sum + (item.discount || 0), 0);
  }, [filteredPayments]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const handleExport = (type) => {
      const columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Student', key: 'student', width: 25 },
          { header: 'Description', key: 'description', width: 35 },
          { header: 'Method', key: 'method', width: 15 },
          { header: 'Amount', key: 'amount', width: 15, format: 'currency', align: 'right', sum: true },
          { header: 'Discount', key: 'discount', width: 15, format: 'currency', align: 'right', sum: true }
      ];
      const title = 'Student Fee Receipts Report';
      const reportDateRange = `${moment(dateRange.startDate).format('DD MMM YYYY')} - ${moment(dateRange.endDate).format('DD MMM YYYY')}`;
      
      const data = filteredPayments.map(p => ({
          date: moment(p.date).format('YYYY-MM-DD'),
          student: p.student ? p.student.name : 'Unknown',
          description: p.description,
          method: 'Cash', 
          amount: p.cashReceived,
          discount: p.discount
      }));

      if (type === 'excel') {
          exportToExcel(data, columns, title, reportDateRange, selectedCompany?.name, theme.palette.success.main);
      } else {
          exportToPDF(data, columns, title, reportDateRange, selectedCompany?.name, theme.palette.success.main);
      }
  };

  const handleEditClick = async (payment) => {
      try {
          const { data } = await getPaymentDetails(payment._id);
          
          setEditingPayment(data);
          setReceiveData({
              studentId: data.student, 
              fee: data.fee, 
              amount: data.amount,
              discount: data.discount || '',
              date: moment(data.date).format('YYYY-MM-DD'),
              method: 'Cash', 
              reference: data.reference || '',
              notes: data.description || ''
          });
          setOpenReceiveDialog(true);
      } catch (error) {
          console.error("Failed to fetch payment details", error);
          alert("Failed to load payment details");
      }
  };

  const handleDeleteClick = async (id) => {
      if (window.confirm("Delete this payment? This will reverse the journal entry and update the student balance.")) {
          try {
              await deletePayment(id);
              fetchPayments();
          } catch (error) {
              const msg = error?.response?.data?.message || error?.message || 'Failed to delete payment';
              console.error("Delete payment error:", msg);
              alert(`Error: ${msg}`);
          }
      }
  };

  const handleCloseDialog = () => {
      setOpenReceiveDialog(false);
      setEditingPayment(null);
      setReceiveData({
          studentId: null,
          fee: null,
          amount: '',
          discount: '',
          date: moment().format('YYYY-MM-DD'),
          method: 'Cash',
          reference: '',
          notes: ''
      });
  };

  const handleReceiveSubmit = async () => {
      if (!receiveData.studentId) {
          alert("Please select a student");
          return;
      }
      if (!receiveData.amount || receiveData.amount <= 0) {
          alert("Please enter a valid amount");
          return;
      }

      try {
          const payload = {
              ...receiveData,
              studentId: receiveData.studentId._id,
              feeId: receiveData.fee ? receiveData.fee._id : null,
              amount: Number(receiveData.amount),
              discount: Number(receiveData.discount || 0)
          };

          if (receiveData.fee) {
              await dispatch(recordPayment({ id: receiveData.fee._id, paymentData: payload })).unwrap();
          } else {
              await dispatch(recordGenericPayment({ studentId: receiveData.studentId._id, paymentData: payload })).unwrap();
          }

          alert("Payment recorded successfully");
          handleCloseDialog();
          fetchPayments();
      } catch (error) {
          console.error("Failed to record payment", error);
          alert(`Failed: ${error.message || 'Unknown error'}`);
      }
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      {/* Header & Stats */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={800} color="text.primary">
              Student Fee Statements
          </Typography>
          <Box display="flex" gap={1}>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => setOpenReceiveDialog(true)}
                sx={{ borderRadius: 2, px: 3, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
              >
                  Record Payment
              </Button>
              <IconButton onClick={fetchPayments}><RefreshIcon /></IconButton>
          </Box>
      </Box>

      <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={4}>
              <StatCard 
                title="Total Received" 
                value={formatCurrency(totalReceived)} 
                icon={<AttachMoneyIcon />} 
                color={theme.palette.success.main}
                trend="This Period"
              />
          </Grid>
          <Grid item xs={12} md={4}>
              <StatCard 
                title="Total Scholarships" 
                value={formatCurrency(totalDiscount)} 
                icon={<AccountBalanceIcon />} 
                color={theme.palette.info.main}
                trend="Discounts Given"
              />
          </Grid>
          <Grid item xs={12} md={4}>
              <StatCard 
                title="Active Students" 
                value={students?.length || 0} 
                icon={<AddIcon />} 
                color={theme.palette.primary.main}
                trend="Total Registered"
              />
          </Grid>
      </Grid>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                  <TextField
                      fullWidth
                      size="small"
                      placeholder="Search by student, description, or reference..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                          startAdornment: (
                              <InputAdornment position="start">
                                  <SearchIcon fontSize="small" />
                              </InputAdornment>
                          ),
                          sx: { borderRadius: 2 }
                      }}
                  />
              </Grid>
              <Grid item xs={12} md={2}>
                  <TextField
                      type="date"
                      label="From"
                      fullWidth
                      size="small"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                  />
              </Grid>
              <Grid item xs={12} md={2}>
                  <TextField
                      type="date"
                      label="To"
                      fullWidth
                      size="small"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                  />
              </Grid>
              <Grid item xs={12} md={4} display="flex" justifyContent="flex-end" gap={1}>
                  <Tooltip title="Export to Excel">
                      <IconButton onClick={() => handleExport('excel')} color="primary"><DownloadIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="Export to PDF">
                      <IconButton onClick={() => handleExport('pdf')} color="error"><DownloadIcon /></IconButton>
                  </Tooltip>
              </Grid>
          </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          {loading && <CircularProgress sx={{ m: 2 }} />}
          <Table>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Received</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Discount</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
              </TableHead>
              <TableBody>
                  {filteredPayments.map((payment) => (
                      <TableRow key={payment._id} hover>
                          <TableCell>{moment(payment.date).format('DD MMM YYYY')}</TableCell>
                          <TableCell>
                              <Typography variant="body2" fontWeight={600}>{payment.student?.name || 'Unknown'}</Typography>
                              <Typography variant="caption" color="text.secondary">{payment.student?.phone}</Typography>
                          </TableCell>
                          <TableCell>
                              <Typography variant="body2">{payment.description}</Typography>
                          </TableCell>
                          <TableCell>
                              <Chip label={payment.reference || 'N/A'} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                              {formatCurrency(payment.cashReceived)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>
                              {payment.discount > 0 ? formatCurrency(payment.discount) : '-'}
                          </TableCell>
                          <TableCell align="center">
                              <Stack direction="row" spacing={1} justifyContent="center">
                                  {/* <IconButton size="small" onClick={() => handleEditClick(payment)}><EditIcon fontSize="inherit" /></IconButton> */}
                                  <IconButton size="small" color="error" onClick={() => handleDeleteClick(payment._id)}><DeleteIcon fontSize="inherit" /></IconButton>
                              </Stack>
                          </TableCell>
                      </TableRow>
                  ))}
                  {filteredPayments.length === 0 && !loading && (
                      <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                              <Typography color="text.secondary">No payment records found for this period.</Typography>
                          </TableCell>
                      </TableRow>
                  )}
              </TableBody>
          </Table>
      </TableContainer>

      {/* Receive Payment Dialog */}
      <Dialog open={openReceiveDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
              {editingPayment ? 'Edit Payment Record' : 'Record Student Payment'}
          </DialogTitle>
          <DialogContent>
              <Box pt={2} display="flex" flexDirection="column" gap={2}>
                  <Autocomplete
                      options={students || []}
                      getOptionLabel={(option) => option.name}
                      value={receiveData.studentId}
                      onChange={(e, newValue) => setReceiveData({ ...receiveData, studentId: newValue, fee: null })}
                      renderInput={(params) => <TextField {...params} label="Select Student" fullWidth size="small" />}
                  />

                  <Autocomplete
                      options={studentFees}
                      getOptionLabel={(option) => `Fee #${option.feeNumber} - Bal: ${formatCurrency(option.balanceDue)}`}
                      value={receiveData.fee}
                      onChange={(e, newValue) => setReceiveData({ ...receiveData, fee: newValue })}
                      renderInput={(params) => <TextField {...params} label="Link to Fee Receipt (Optional)" fullWidth size="small" />}
                      disabled={!receiveData.studentId || loadingFees}
                      loading={loadingFees}
                  />

                  <Grid container spacing={2}>
                      <Grid item xs={6}>
                          <TextField
                              label="Amount Received"
                              type="number"
                              fullWidth
                              size="small"
                              value={receiveData.amount}
                              onChange={(e) => setReceiveData({ ...receiveData, amount: e.target.value })}
                              required
                          />
                      </Grid>
                      <Grid item xs={6}>
                          <TextField
                              label="Scholarship / Discount"
                              type="number"
                              fullWidth
                              size="small"
                              value={receiveData.discount}
                              onChange={(e) => setReceiveData({ ...receiveData, discount: e.target.value })}
                          />
                      </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                      <Grid item xs={6}>
                          <TextField
                              label="Date"
                              type="date"
                              fullWidth
                              size="small"
                              value={receiveData.date}
                              onChange={(e) => setReceiveData({ ...receiveData, date: e.target.value })}
                              InputLabelProps={{ shrink: true }}
                          />
                      </Grid>
                      <Grid item xs={6}>
                          <FormControl fullWidth size="small">
                              <InputLabel>Payment Method</InputLabel>
                              <Select
                                  value={receiveData.method}
                                  label="Payment Method"
                                  onChange={(e) => setReceiveData({ ...receiveData, method: e.target.value })}
                              >
                                  <MenuItem value="Cash">Cash</MenuItem>
                                  <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                                  <MenuItem value="Cheque">Cheque</MenuItem>
                                  <MenuItem value="Other">Other</MenuItem>
                              </Select>
                          </FormControl>
                      </Grid>
                  </Grid>

                  <TextField
                      label="Reference (Cheque # / Trans ID)"
                      fullWidth
                      size="small"
                      value={receiveData.reference}
                      onChange={(e) => setReceiveData({ ...receiveData, reference: e.target.value })}
                  />

                  <TextField
                      label="Internal Notes"
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      value={receiveData.notes}
                      onChange={(e) => setReceiveData({ ...receiveData, notes: e.target.value })}
                  />
              </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
              <Button variant="contained" onClick={handleReceiveSubmit} sx={{ borderRadius: 2, px: 4 }}>
                  {editingPayment ? 'Update Record' : 'Record Payment'}
              </Button>
          </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Payments;
