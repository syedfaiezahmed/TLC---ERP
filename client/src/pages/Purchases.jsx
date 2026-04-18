import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { deletePurchase, getPurchases } from '../redux/purchaseSlice';
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
  IconButton,
  Chip,
  Box,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  useTheme,
  alpha,
  Grid,
  Stack,
  Tooltip,
} from '@mui/material';
import { TableRowSkeleton } from '../components/SkeletonLoaders';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  ReceiptLong as ReceiptLongIcon,
  Paid as PaidIcon,
  PendingActions as PendingActionsIcon
} from '@mui/icons-material';
import moment from 'moment';
import StatCard from '../components/StatCard';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { toast } from 'react-toastify';

const StatusChip = ({ status }) => {
    const theme = useTheme();
    let bgcolor = alpha(theme.palette.info.main, 0.1);
    let textColor = theme.palette.info.dark;

    if (status === 'paid') {
        bgcolor = alpha(theme.palette.success.main, 0.1);
        textColor = theme.palette.success.dark;
    } else if (status === 'partial') {
        bgcolor = alpha(theme.palette.warning.main, 0.1);
        textColor = theme.palette.warning.dark;
    }

    return (
        <Chip label={status.toUpperCase()} size="small" sx={{ bgcolor, color: textColor, fontWeight: 700, borderRadius: 1 }} />
    );
};

const Purchases = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId } = useParams();
  const theme = useTheme();
  
  const { purchases, loading } = useSelector((state) => state.purchases);
  const { selectedCompany } = useSelector((state) => state.companies);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    startDate: moment().startOf('month').format('YYYY-MM-DD'),
    endDate: moment().endOf('month').format('YYYY-MM-DD'),
  });

  useEffect(() => {
    if (companyId) {
      dispatch(getPurchases({ companyId, params: { status: 'all' } }));
    }
  }, [dispatch, companyId]);

  const filteredPurchases = useMemo(() => {
    let data = [...purchases];

    if (statusFilter !== 'all') {
      data = data.filter((p) => p.status === statusFilter);
    }

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
      data = data.filter((p) =>
        (p.teacher?.name || '').toLowerCase().includes(q) ||
        (p.supplier || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        String(p.purchaseNumber || '').includes(q)
      );
    }

    return data;
  }, [dateRange.endDate, dateRange.startDate, purchases, searchTerm, statusFilter]);

  const totals = useMemo(() => {
    const totalAmount = filteredPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const paid = filteredPurchases.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
    const due = filteredPurchases.reduce((sum, p) => sum + Number(p.balanceDue || 0), 0);
    return { totalAmount, paid, due };
  }, [filteredPurchases]);

  const formatCurrency = (amount) => `PKR ${Number(amount || 0).toLocaleString()}`;

  const handleExport = async (type) => {
    const dateLabel = `${moment(dateRange.startDate).format('MMM D')} - ${moment(dateRange.endDate).format('MMM D')}`;
    const companyName = selectedCompany?.name || 'Coaching ERP';

    const rows = filteredPurchases.map((p) => ({
      bill: `#${p.purchaseNumber}`,
      teacher: p.teacher?.name || '',
      date: p.date,
      dueDate: p.dueDate,
      status: p.status,
      total: Number(p.totalAmount || 0),
      paid: Number(p.paidAmount || 0),
      balance: Number(p.balanceDue || 0),
    }));

    const columns = [
      { header: 'Bill #', key: 'bill' },
      { header: 'Teacher', key: 'teacher' },
      { header: 'Date', key: 'date', format: 'date' },
      { header: 'Due Date', key: 'dueDate', format: 'date' },
      { header: 'Status', key: 'status' },
      { header: 'Total', key: 'total', format: 'currency', sum: true },
      { header: 'Paid', key: 'paid', format: 'currency', sum: true },
      { header: 'Balance', key: 'balance', format: 'currency', sum: true },
    ];

    if (type === 'excel') {
      await exportToExcel(rows, columns, 'Teacher Bills / Purchases', dateLabel, companyName, '#087A94');
    } else {
      exportToPDF(rows, columns, 'Teacher Bills / Purchases', dateLabel, companyName, '#087A94');
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5 }}>
            Bills & Purchases
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track and manage your teacher bills and institute procurement.
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
              onClick={() => navigate(`/company/${companyId}/purchases/create`)}
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
              Record Bill
            </Button>
          </Stack>
        </Box>
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <StatCard title="Total Bills" value={formatCurrency(totals.totalAmount)} icon={<ReceiptLongIcon sx={{ fontSize: 32 }} />} color={theme.palette.primary.main} />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard title="Total Paid" value={formatCurrency(totals.paid)} icon={<PaidIcon sx={{ fontSize: 32 }} />} color={theme.palette.success.main} />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard title="Outstanding Payable" value={formatCurrency(totals.due)} icon={<PendingActionsIcon sx={{ fontSize: 32 }} />} color={theme.palette.error.main} />
        </Grid>
      </Grid>

      <Card sx={{ mb: 3, borderRadius: 4, overflow: 'visible', border: 'none', boxShadow: theme.shadows[1] }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search Bill # or Teacher..."
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
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ borderRadius: 2 }}>
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={5}>
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
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Bill #</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Vendor / Teacher</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Balance</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowSkeleton rows={8} cols={8} />
              ) : filteredPurchases.length > 0 ? (
                filteredPurchases.map((purchase) => (
                  <TableRow key={purchase._id} hover>
                    <TableCell sx={{ py: 1.5 }}>#{purchase.purchaseNumber}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      {purchase.category === 'asset' && <Chip label="Asset" size="small" color="success" sx={{ fontWeight: 700, fontSize: '0.68rem' }} />}
                      {purchase.category === 'expense' && <Chip label="Expense" size="small" color="warning" sx={{ fontWeight: 700, fontSize: '0.68rem' }} />}
                      {(!purchase.category || purchase.category === 'teacher_payment') && <Chip label="Teacher Bill" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.68rem' }} />}
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        {purchase.teacher?.name || purchase.supplier || purchase.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, color: 'text.secondary' }}>
                      {moment(purchase.date).format('DD MMM YYYY')}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>{formatCurrency(purchase.totalAmount)}</TableCell>
                    <TableCell align="right" sx={{ py: 1.5, fontWeight: 800, color: purchase.balanceDue > 0 ? 'error.main' : 'success.main' }}>
                      {formatCurrency(purchase.balanceDue)}
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <StatusChip status={purchase.status} />
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Box display="flex" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title="View">
                          <IconButton
                            onClick={() => navigate(`/company/${companyId}/purchases/${purchase._id}`)}
                            size="small"
                            sx={{
                              color: theme.palette.info.main,
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              borderRadius: 1.5,
                              padding: 0.5,
                              '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.2) },
                            }}
                          >
                            <VisibilityIcon fontSize="small" sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            onClick={() => navigate(`/company/${companyId}/purchases/edit/${purchase._id}`)}
                            size="small"
                            sx={{
                              color: theme.palette.primary.main,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              borderRadius: 1.5,
                              padding: 0.5,
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                            }}
                          >
                            <EditIcon fontSize="small" sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to delete this bill?')) return;
                              try {
                                await dispatch(deletePurchase(purchase._id)).unwrap();
                                toast.success('Bill deleted successfully');
                              } catch (e) {
                                toast.error(e?.message || e?.data?.message || 'Failed to delete bill');
                              }
                            }}
                            size="small"
                            sx={{
                              color: theme.palette.error.main,
                              bgcolor: alpha(theme.palette.error.main, 0.1),
                              borderRadius: 1.5,
                              padding: 0.5,
                              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) },
                            }}
                          >
                            <DeleteIcon fontSize="small" sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Purchase Return">
                          <IconButton
                            onClick={() => navigate(`/company/${companyId}/purchase-returns`)}
                            size="small"
                            sx={{
                              color: theme.palette.warning.main,
                              bgcolor: alpha(theme.palette.warning.main, 0.1),
                              borderRadius: 1.5,
                              padding: 0.5,
                              '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) },
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
                  <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No bills found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Container>
  );
};

export default Purchases;
