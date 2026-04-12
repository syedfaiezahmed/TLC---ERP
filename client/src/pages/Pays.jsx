import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { getTeachers } from '../redux/teacherSlice';
import { getPurchases, recordTeacherPayment, deletePurchasePayment } from '../redux/purchaseSlice';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Avatar,
  Grid,
  Divider,
  MenuItem,
  Stack,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Payments as PaymentsIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  AccountBalance as AccountBalanceIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import moment from 'moment';
import { toast } from 'react-toastify';
import StatCard from '../components/StatCard';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const Pays = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId } = useParams();
  const theme = useTheme();
  
  const { teachers } = useSelector((state) => state.teachers);
  const { purchases, loading } = useSelector((state) => state.purchases);
  const { selectedCompany } = useSelector((state) => state.companies);
  
  const [open, setOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: moment().startOf('month').format('YYYY-MM-DD'),
    endDate: moment().endOf('month').format('YYYY-MM-DD'),
  });
  const [formData, setFormData] = useState({
    amount: '',
    discount: '',
    date: moment().format('YYYY-MM-DD'),
    method: 'Cash',
    reference: ''
  });

  useEffect(() => {
    if (companyId) {
      dispatch(getTeachers({ companyId }));
      dispatch(getPurchases({ companyId, params: { status: 'all' } }));
    }
  }, [dispatch, companyId]);

  const handleOpen = () => setOpen(true);
  const handleDeletePayment = async (purchaseId, paymentId) => {
    if (!window.confirm('Delete this payment? This will reverse the journal entry.')) return;
    try {
      await dispatch(deletePurchasePayment({ purchaseId, paymentId })).unwrap();
      toast.success('Payment reversed and deleted');
      dispatch(getPurchases({ companyId, params: { status: 'all' } }));
    } catch (error) {
      toast.error(error?.message || 'Failed to delete payment');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedTeacher(null);
    setSelectedPurchase(null);
    setFormData({ amount: '', discount: '', date: moment().format('YYYY-MM-DD'), method: 'Cash', reference: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPurchase) return toast.error('Please select a bill');
    if (!formData.amount || formData.amount <= 0) return toast.error('Enter valid payment amount');

    try {
      await dispatch(recordTeacherPayment({ 
          id: selectedPurchase._id, 
          paymentData: formData 
      })).unwrap();
      toast.success('Faculty payment recorded successfully');
      handleClose();
      dispatch(getPurchases({ companyId, params: { status: 'all' } }));
    } catch (error) {
      toast.error(error.message || 'Failed to record payment');
    }
  };

  const allPayments = useMemo(() => {
    return purchases
      .flatMap((p) =>
        (p.payments || []).map((pmt) => ({
          ...pmt,
          purchaseNo: p.purchaseNumber,
          teacher: p.teacher?.name || p.supplier || p.description || 'N/A',
          purchaseId: p._id,
          settlement: Number(pmt.amount || 0) + Number(pmt.discount || 0),
        }))
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [purchases]);

  const filteredPayments = useMemo(() => {
    let data = [...allPayments];

    const start = moment(dateRange.startDate, 'YYYY-MM-DD', true).isValid()
      ? moment(dateRange.startDate).startOf('day')
      : null;
    const end = moment(dateRange.endDate, 'YYYY-MM-DD', true).isValid()
      ? moment(dateRange.endDate).endOf('day')
      : null;

    if (start && end) {
      data = data.filter((p) => moment(p.date).isBetween(start, end, undefined, '[]'));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      data = data.filter((p) => {
        return (
          (p.teacher || '').toLowerCase().includes(q) ||
          String(p.purchaseNo || '').includes(q) ||
          (p.reference || '').toLowerCase().includes(q) ||
          (p.method || '').toLowerCase().includes(q)
        );
      });
    }

    return data;
  }, [allPayments, dateRange.endDate, dateRange.startDate, searchTerm]);

  const totalPaid = useMemo(() => filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0), [filteredPayments]);
  const totalDiscount = useMemo(() => filteredPayments.reduce((sum, p) => sum + Number(p.discount || 0), 0), [filteredPayments]);

  const formatCurrency = (amount) => {
    return `PKR ${Number(amount || 0).toLocaleString()}`;
  };

  const handleExport = async (type) => {
    const dateLabel = `${moment(dateRange.startDate).format('MMM D')} - ${moment(dateRange.endDate).format('MMM D')}`;
    const companyName = selectedCompany?.name || 'Coaching ERP';

    const rows = filteredPayments.map((p) => ({
      date: p.date,
      teacher: p.teacher,
      bill: `#${p.purchaseNo}`,
      method: p.method,
      reference: p.reference || '',
      paid: Number(p.amount || 0),
      discount: Number(p.discount || 0),
      settlement: Number(p.settlement || 0),
    }));

    const columns = [
      { header: 'Date', key: 'date', format: 'date' },
      { header: 'Teacher', key: 'teacher' },
      { header: 'Bill #', key: 'bill' },
      { header: 'Method', key: 'method' },
      { header: 'Reference', key: 'reference' },
      { header: 'Paid', key: 'paid', format: 'currency', sum: true },
      { header: 'Discount', key: 'discount', format: 'currency', sum: true },
      { header: 'Settlement', key: 'settlement', format: 'currency', sum: true },
    ];

    if (type === 'excel') {
      await exportToExcel(rows, columns, 'Bill Payments', dateLabel, companyName, '#087A94');
    } else {
      exportToPDF(rows, columns, 'Bill Payments', dateLabel, companyName, '#087A94');
    }
  };

  const outstandingBills = useMemo(() => {
    if (selectedTeacher) {
      return purchases.filter((p) => p.teacher?._id === selectedTeacher._id && Number(p.balanceDue || 0) > 0);
    }
    return purchases.filter((p) => Number(p.balanceDue || 0) > 0);
  }, [purchases, selectedTeacher]);

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5 }}>
            Bill Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Record and track AP payments against outstanding purchase bills.
          </Typography>
        </Box>
        <Box display="flex" gap={2} width={{ xs: '100%', md: 'auto' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width="100%">
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
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => dispatch(getPurchases({ companyId, params: { status: 'all' } }))}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: 'secondary.main',
                boxShadow: 'none',
                flex: { xs: 1, sm: 'none' },
                '&:hover': { bgcolor: 'secondary.dark', boxShadow: 'none' },
              }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpen}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: 'primary.main',
                boxShadow: 'none',
                flex: { xs: 1, sm: 'none' },
                '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none' },
              }}
            >
              Record Payment
            </Button>
          </Stack>
        </Box>
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Paid"
            value={formatCurrency(totalPaid)}
            icon={<PaymentsIcon sx={{ fontSize: 32 }} />}
            color={theme.palette.success.main}
            subtitle={`For ${moment(dateRange.startDate).format('MMM D')} - ${moment(dateRange.endDate).format('MMM D')}`}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Adjustments"
            value={formatCurrency(totalDiscount)}
            icon={<AccountBalanceIcon sx={{ fontSize: 32 }} />}
            color={theme.palette.warning.main}
            subtitle="Discounts recorded"
          />
        </Grid>
      </Grid>

      <Card sx={{ mb: 3, borderRadius: 4, overflow: 'visible', border: 'none', boxShadow: theme.shadows[1] }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by Teacher, Bill #, Reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2, bgcolor: 'background.default' },
                }}
              />
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent={{ md: 'flex-end' }}>
                <TextField
                  label="From Date"
                  type="date"
                  size="small"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange((p) => ({ ...p, startDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 160 }}
                />
                <TextField
                  label="To Date"
                  type="date"
                  size="small"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange((p) => ({ ...p, endDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 160 }}
                />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4, overflow: 'hidden', border: 'none', boxShadow: theme.shadows[1] }}>
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <HistoryIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={800}>
            Bill Payment History
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Vendor / Teacher</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Bill #</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Method</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Paid</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Adjustment</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Settlement</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={30} />
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length > 0 ? (
                filteredPayments.map((pmt, i) => (
                  <TableRow key={pmt._id || i} hover>
                    <TableCell sx={{ py: 1.5 }}>{moment(pmt.date).format('DD MMM YYYY')}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        {pmt.teacher || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, color: 'text.secondary' }}>#{pmt.purchaseNo}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={pmt.method || 'Cash'}
                        size="small"
                        sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.dark', fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {formatCurrency(pmt.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      {formatCurrency(pmt.discount)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, fontWeight: 800 }}>
                      {formatCurrency(pmt.settlement)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Tooltip title="View Bill">
                        <Button size="small" variant="text" onClick={() => navigate(`/company/${companyId}/purchases/${pmt.purchaseId}`)} startIcon={<VisibilityIcon />}>
                          View
                        </Button>
                      </Tooltip>
                      <Tooltip title="Reverse & Delete Payment">
                        <IconButton size="small" color="error" onClick={() => handleDeletePayment(pmt.purchaseId, pmt._id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={2}>
                      <AccountBalanceIcon sx={{ fontSize: 40, color: 'text.disabled', opacity: 0.5, mb: 1 }} />
                      <Typography color="text.secondary">No payments found for this period.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Record Bill Payment</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Autocomplete
                options={teachers}
                getOptionLabel={(option) => option.name}
                onChange={(e, val) => {
                    setSelectedTeacher(val);
                    setSelectedPurchase(null);
                }}
                renderInput={(params) => <TextField {...params} label="Filter by Teacher (optional)" />}
              />

              <Autocomplete
                  options={outstandingBills}
                  getOptionLabel={(option) => `Bill #${option.purchaseNumber} | ${option.teacher?.name || option.supplier || option.description || 'N/A'} | Bal: PKR ${Number(option.balanceDue || 0).toLocaleString()}`}
                  onChange={(e, val) => {
                      setSelectedPurchase(val);
                      setFormData({ ...formData, amount: val ? val.balanceDue : '' });
                  }}
                  renderInput={(params) => <TextField {...params} label="Select Outstanding Bill *" required />}
              />

              {selectedPurchase && (
                <>
                    <Divider sx={{ my: 1 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Payment Date" type="date" fullWidth required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} InputLabelProps={{ shrink: true }} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField select label="Method" fullWidth required value={formData.method} onChange={(e) => setFormData({ ...formData, method: e.target.value })}>
                                <MenuItem value="Cash">Cash</MenuItem>
                                <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                                <MenuItem value="Cheque">Cheque</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Amount to Pay" type="number" fullWidth required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Adjustment / Discount" type="number" fullWidth value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField label="Reference / Cheque #" fullWidth value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} />
                        </Grid>
                    </Grid>
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleClose} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" disabled={!selectedPurchase} startIcon={<PaymentsIcon />}>Post Payment</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default Pays;
