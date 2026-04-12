import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useLocation } from 'react-router-dom';
import { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createJournalEntry } from '../redux/ledgerSlice';
import { getStudents } from '../redux/studentSlice';
import { getAccounts } from '../redux/accountSlice';
import { syncFeeJournals } from '../services/api';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Alert,
  Box,
  Chip,
  Grid,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  useTheme,
  alpha,
  Stack,
  Autocomplete,
  Divider,
  TablePagination,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BookIcon from '@mui/icons-material/Book';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import moment from 'moment';
import StatCard from '../components/StatCard';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const Ledger = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const location = useLocation();
  const { companyId } = useParams();
  
  // Parse query parameters
  const queryParams = new URLSearchParams(location.search);
  const initialStudentId = queryParams.get('studentId') || '';

  const { entries, loading, error } = useSelector((state) => state.ledger);
  const { selectedCompany } = useSelector((state) => state.companies);
  const { students } = useSelector((state) => state.students); // Get students for dropdown
  const { accounts } = useSelector((state) => state.accounts);
  const currentCompanyId = companyId || selectedCompany?._id;
  
  const [open, setOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [formData, setFormData] = useState({ 
      date: moment().format('YYYY-MM-DD'), 
      description: '', 
      type: 'debit', 
      amount: '', 
      reference: '',
      accountName: 'Cash', // Default
      accountType: 'asset'
  });

  const [journalData, setJournalOpenData] = useState({
      date: moment().format('YYYY-MM-DD'),
      description: '',
      reference: '',
      lines: [
          { accountName: 'Cash', accountType: 'asset', debit: '', credit: '', description: '' },
          { accountName: 'Owner Capital', accountType: 'equity', debit: '', credit: '', description: '' }
      ]
  });

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [accountFilter, setAccountFilter] = useState('all'); 
  const [studentFilter, setStudentFilter] = useState(initialStudentId); // Add student filter
  const [typeFilter, setTypeFilter] = useState('all'); // Add type filter
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(50);
  const [syncing, setSyncing] = useState(false);

  // Local state for immediate input feedback
  const [localSearch, setLocalSearch] = useState('');

  const handleSyncJournals = async () => {
    if (!window.confirm('This will create ledger entries for all existing fee payments that are missing them. Continue?')) return;
    setSyncing(true);
    try {
      const { data } = await syncFeeJournals();
      alert(`✅ ${data.message}`);
      setTimeout(() => fetchLedgerData(), 800);
    } catch (err) {
      alert(`❌ Sync failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Fetch students and accounts on mount
  useEffect(() => {
      if (currentCompanyId) {
          dispatch(getStudents({ companyId: currentCompanyId, page: 1, limit: 1000, search: '' }));
          dispatch(getAccounts(currentCompanyId));
      }
  }, [dispatch, currentCompanyId]);

  // Update student filter if URL param changes
  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const studentId = params.get('studentId');
      if (studentId) {
          setStudentFilter(studentId);
      }
  }, [location.search]);

  // Debounce fetch for search only
  const debounceFn = (fn, delay) => {
    let timeoutId;
    const debounced = (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn(...args), delay);
    };
    debounced.clear = () => window.clearTimeout(timeoutId);
    return debounced;
  };

  const debouncedSearch = useMemo(
    () => debounceFn((searchVal) => {
        setSearchTerm(searchVal);
    }, 500),
    []
  );

  const handleSearchChange = (e) => {
      const val = e.target.value;
      setLocalSearch(val);
      debouncedSearch(val);
      setPage(0);
  };

  const fetchLedgerData = useCallback(() => {
    if (!currentCompanyId) return;
    dispatch(
      getLedger({
        companyId: currentCompanyId,
        page: page + 1,
        limit: rowsPerPage,
        startDate: dateRange.start,
        endDate: dateRange.end,
        accountName: accountFilter === 'all' ? '' : accountFilter,
        studentId: studentFilter,
        type: typeFilter === 'all' ? '' : typeFilter,
        search: searchTerm || '',
      })
    );
  }, [dispatch, currentCompanyId, page, rowsPerPage, dateRange.start, dateRange.end, accountFilter, studentFilter, typeFilter, searchTerm]);

  useEffect(() => {
    fetchLedgerData();
  }, [fetchLedgerData]);

  // Cleanup debounce on unmount
  useEffect(() => {
      // Sync local search state with Redux/URL if needed (optional)
      // For now, we assume user starts fresh or URL params handle it
      return () => {
          debouncedSearch.clear();
      }
  }, [debouncedSearch]);

  const accountOptions = [
      'Accounts Receivable',
      'Fee Revenue',
      'Cash',
      'Accounts Payable',
      'Equity',
      'Expense'
  ];

  const filteredEntries = useMemo(() => {
      // Backend handles filtering now
      return entries || [];
  }, [entries]);

  const summary = useMemo(() => {
      return filteredEntries.reduce((acc, entry) => {
          acc.debit += entry.debit || 0;
          acc.credit += entry.credit || 0;
          return acc;
      }, { debit: 0, credit: 0 });
  }, [filteredEntries]);

  const handleJournalSubmit = async (e) => {
      e.preventDefault();
      const totalDebit = journalData.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
      const totalCredit = journalData.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
          alert('Journal entry must be balanced (Debits must equal Credits)');
          return;
      }

      const res = await dispatch(createJournalEntry({ ...journalData, companyId: currentCompanyId }));
      if (!res.error) {
          alert('Journal entry posted successfully!');
          setJournalOpen(false);
          // Small delay to allow DB to process insertMany
          setTimeout(() => fetchLedgerData(), 1000);
          setJournalOpenData({
              date: moment().format('YYYY-MM-DD'),
              description: '',
              reference: '',
              lines: [
                  { accountName: 'Cash', accountType: 'asset', debit: '', credit: '', description: '' },
                  { accountName: 'Owner Capital', accountType: 'equity', debit: '', credit: '', description: '' }
              ]
          });
      } else {
          alert(`Failed to post journal: ${res.payload?.message || res.error?.message || 'Unknown error'}`);
      }
  };

  const handleJournalLineChange = (index, field, value) => {
      const newLines = [...journalData.lines];
      newLines[index][field] = value;
      
      // Auto-set accountType if accountName is selected
      if (field === 'accountName' && accounts) {
          const acc = accounts.find(a => a.name === value);
          if (acc) newLines[index].accountType = acc.type;
      }
      
      setJournalOpenData({ ...journalData, lines: newLines });
  };

  const addJournalLine = () => {
      setJournalOpenData({
          ...journalData,
          lines: [...journalData.lines, { accountName: '', accountType: 'asset', debit: '', credit: '', description: '' }]
      });
  };

  const removeJournalLine = (index) => {
      if (journalData.lines.length <= 2) return;
      setJournalOpenData({
          ...journalData,
          lines: journalData.lines.filter((_, i) => i !== index)
      });
  };

  const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 0
      }).format(amount || 0);
  };

  const handleExport = (type) => {
      const columns = [
          { header: 'Date', key: 'date', format: 'date' },
          { header: 'Account', key: 'accountName' },
          { header: 'Description', key: 'description' },
          { header: 'Reference', key: 'reference' },
          { header: 'Debit', key: 'debit', format: 'currency', align: 'right', sum: true },
          { header: 'Credit', key: 'credit', format: 'currency', align: 'right', sum: true },
          { header: 'Balance', key: 'balance', format: 'currency', align: 'right' }
      ];

      const title = `General Ledger - ${selectedCompany?.name || 'ERP'}`;
      const dateLabel = dateRange.start && dateRange.end 
          ? `${moment(dateRange.start).format('MMM D, YYYY')} - ${moment(dateRange.end).format('MMM D, YYYY')}`
          : 'All Periods';

      if (type === 'excel') {
          exportToExcel(filteredEntries, columns, title, dateLabel, selectedCompany?.name);
      } else {
          exportToPDF(filteredEntries, columns, title, dateLabel, selectedCompany?.name, theme.palette.primary.main);
      }
  };

  const handlePrint = () => {
      window.print();
  };

  const handleExportCSV = () => {
      const headers = ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'];
      const csvContent = [
          headers.join(','),
          ...filteredEntries.map(entry => [
              moment(entry.date).format('YYYY-MM-DD'),
              `"${entry.description}"`,
              entry.reference || '',
              entry.debit || 0,
              entry.credit || 0,
              entry.balance || 0
          ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `ledger_export_${moment().format('YYYY-MM-DD')}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  const handleOpen = (entry = null) => {
    if (entry) {
      setCurrentEntry(entry);
      setFormData({ 
          date: moment(entry.date).format('YYYY-MM-DD'), 
          description: entry.description, 
          type: entry.debit > 0 ? 'debit' : 'credit', 
          amount: entry.debit > 0 ? entry.debit : entry.credit, 
          reference: entry.reference || '' 
      });
    } else {
      setCurrentEntry(null);
      setFormData({ date: moment().format('YYYY-MM-DD'), description: '', type: 'debit', amount: '', reference: '' });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentEntry(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!currentCompanyId) return;
    
    // Transform data for backend
    const payload = { 
        companyId: currentCompanyId,
        date: formData.date,
        description: formData.description,
        reference: formData.reference,
        type: 'adjustment', // Default type for manual entries
        debit: formData.type === 'debit' ? Number(formData.amount) : 0,
        credit: formData.type === 'credit' ? Number(formData.amount) : 0,
        accountName: formData.accountName,
        accountType: formData.accountType
    };

    let res;
    if (currentEntry) {
      res = await dispatch(updateLedgerEntry({ id: currentEntry._id, entry: payload }));
    } else {
      res = await dispatch(createLedgerEntry(payload));
    }

    if (!res.error) {
        alert(currentEntry ? 'Entry updated successfully!' : 'Entry added successfully!');
        handleClose();
        // Ideally refetch to ensure balance is correct
        setTimeout(() => fetchLedgerData(), 500);
    } else {
        alert(`Failed: ${res.payload?.message || res.error?.message || 'Unknown error'}`);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      dispatch(deleteLedgerEntry(id));
      if (currentCompanyId) setTimeout(() => fetchLedgerData(), 500);
    }
  };

  if (!currentCompanyId) {
      return (
          <Box p={3}>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>Please select a company from the Dashboard first.</Alert>
          </Box>
      )
  }

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box sx={{ '@media print': { display: 'none' } }}>
        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={2}>
            <Box>
                <Typography variant="h5" fontWeight={800} sx={{ 
                    color: 'text.primary',
                    mb: 0.5,
                    letterSpacing: -0.5
                }}>
                    General Ledger
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Track financial transactions, debits, and credits for {selectedCompany?.name || 'Company'}.
                </Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Button 
                  variant="outlined" 
                  startIcon={<DownloadIcon />} 
                  onClick={() => handleExport('excel')}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#1D6F42', borderColor: '#1D6F42' }}
              >
                  Excel
              </Button>
              <Button 
                  variant="outlined" 
                  startIcon={<DownloadIcon />} 
                  onClick={() => handleExport('pdf')}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: '#D32F2F', borderColor: '#D32F2F' }}
              >
                  PDF
              </Button>
              <Button 
                  variant="outlined" 
                  size="medium"
                  startIcon={<PrintIcon />} 
                  onClick={handlePrint}
                  sx={{ 
                      borderRadius: 2, 
                      textTransform: 'none',
                      fontWeight: 600,
                      color: 'text.secondary',
                      borderColor: 'divider',
                      '&:hover': {
                          bgcolor: 'action.hover',
                          borderColor: 'text.secondary'
                      }
                  }}
              >
                  Print
              </Button>
              <Button 
                  variant="contained" 
                  size="medium"
                  startIcon={<RefreshIcon />} 
                  onClick={fetchLedgerData}
                  sx={{ 
                      px: 3, 
                      borderRadius: 2, 
                      textTransform: 'none',
                      boxShadow: 'none',
                      bgcolor: 'secondary.main',
                      '&:hover': {
                          bgcolor: 'secondary.dark',
                          boxShadow: 'none'
                      }
                  }}
              >
                  Refresh
              </Button>
              <Tooltip title="Sync ledger entries for existing fee payments that are missing journal records">
                <Button 
                    variant="outlined" 
                    size="medium"
                    startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
                    onClick={handleSyncJournals}
                    disabled={syncing}
                    sx={{ borderRadius: 2, textTransform: 'none', borderColor: 'warning.main', color: 'warning.dark', px: 2, fontWeight: 600 }}
                >
                    {syncing ? 'Syncing…' : 'Sync Financials'}
                </Button>
              </Tooltip>
              <Button 
                  variant="outlined" 
                  size="medium"
                  startIcon={<AddIcon />} 
                  onClick={() => setJournalOpen(true)}
                  sx={{ borderRadius: 2, textTransform: 'none', borderColor: 'divider', color: 'text.secondary', px: 2 }}
              >
                  Manual Journal (JV)
              </Button>
              <Button 
                  variant="contained" 
                  size="medium"
                  startIcon={<AddIcon />} 
                  onClick={() => handleOpen()}
                  sx={{ 
                      px: 3, 
                      borderRadius: 2, 
                      textTransform: 'none',
                      boxShadow: 'none',
                      bgcolor: 'primary.main',
                      '&:hover': {
                          bgcolor: 'primary.dark',
                          boxShadow: 'none'
                      }
                  }}
              >
                  Add Entry
              </Button>
            </Stack>
        </Box>

        {/* Summary Cards - Revenue Focused */}
        <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={4}>
                <StatCard 
                    title="Total Revenue" 
                    value={formatCurrency(summary.credit)} 
                    icon={<TrendingUpIcon sx={{ fontSize: 32 }} />} 
                    color={theme.palette.success.main}
                    subtitle="Fee Receipts generated"
                />
            </Grid>
            <Grid item xs={12} md={4}>
                <StatCard 
                    title="Outstanding" 
                    value={formatCurrency(summary.debit)} 
                    icon={<AccountBalanceWalletIcon sx={{ fontSize: 32 }} />} 
                    color={theme.palette.warning.main}
                    subtitle="Student receivables"
                />
            </Grid>
            <Grid item xs={12} md={4}>
                <StatCard 
                    title="Closing Balance" 
                    value={formatCurrency(summary.debit - summary.credit)} 
                    icon={<BookIcon sx={{ fontSize: 32 }} />} 
                    color={theme.palette.info.main}
                    subtitle="Net profit/loss"
                />
            </Grid>
        </Grid>
      </Box>

      {/* Filter Controls (NEW: Categorized and Searchable) */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                options={students || []}
                getOptionLabel={(option) => option.name}
                value={students?.find(s => s._id === studentFilter) || null}
                onChange={(event, newValue) => setStudentFilter(newValue ? newValue._id : '')}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Select Student" 
                    size="small" 
                    placeholder="Search students..."
                    sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Account</InputLabel>
                <Select
                  value={accountFilter}
                  label="Account"
                  onChange={(e) => setAccountFilter(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="all">All Accounts</MenuItem>
                  {accounts?.map(acc => (
                      <MenuItem key={acc._id} value={acc.name}>{acc.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
              <Grid item xs={12} md={4}>
                  <TextField
                      fullWidth
                      placeholder="Search Description or Reference"
                      value={localSearch}
                      onChange={handleSearchChange}
                      InputProps={{
                          startAdornment: (
                              <InputAdornment position="start">
                                  <SearchIcon color="action" fontSize="small" />
                              </InputAdornment>
                          ),
                          sx: { borderRadius: 2, bgcolor: 'white' }
                      }}
                      size="small"
                  />
              </Grid>
              <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                          value={typeFilter}
                          label="Type"
                          onChange={(e) => setTypeFilter(e.target.value)}
                          sx={{ borderRadius: 2, bgcolor: 'white' }}
                      >
                          <MenuItem value="all">All Transactions</MenuItem>
                          <MenuItem value="debit">Debit Only</MenuItem>
                          <MenuItem value="credit">Credit Only</MenuItem>
                      </Select>
                  </FormControl>
              </Grid>
              <Grid item xs={12} md={5}>
                  <Box display="flex" gap={2}>
                      <TextField
                          label="From"
                          type="date"
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          value={dateRange.start}
                          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                          fullWidth
                          InputProps={{ sx: { borderRadius: 2, bgcolor: 'white' } }}
                      />
                      <TextField
                          label="To"
                          type="date"
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          value={dateRange.end}
                          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                          fullWidth
                          InputProps={{ sx: { borderRadius: 2, bgcolor: 'white' } }}
                      />
                  </Box>
              </Grid>
          </Grid>
      </Paper>

      <div id="printable-ledger">
          <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 3 } }}>
                <Typography variant="h4" gutterBottom>{selectedCompany?.name || 'Company'}</Typography>
                <Typography variant="h5" gutterBottom>General Ledger</Typography>
                <Typography variant="subtitle2">
                    Date: {moment().format('DD MMM YYYY')}
                </Typography>
          </Box>

          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, overflowX: 'auto', boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
            <Table sx={{ minWidth: 650 }} size="small">
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Account</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }}>Reference</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }} align="right">Debit</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }} align="right">Credit</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none' }} align="right">Balance</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, color: 'text.secondary', borderBottom: 'none', '@media print': { display: 'none' } }} align="right">Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {filteredEntries.length > 0 ? (
                    filteredEntries.map((entry) => (
                    <TableRow 
                        key={entry._id}
                        hover
                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                        <TableCell sx={{ py: 1 }}>{moment(entry.date).format('DD MMM, YYYY')}</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 1, color: 'primary.main' }}>{entry.accountName || '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 500, py: 1 }}>{entry.description}</TableCell>
                        <TableCell sx={{ py: 1 }}>
                            {entry.reference ? <Chip label={entry.reference} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} /> : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', bgcolor: entry.debit > 0 ? alpha(theme.palette.error.main, 0.05) : 'transparent', py: 1 }}>
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', bgcolor: entry.credit > 0 ? alpha(theme.palette.success.main, 0.05) : 'transparent', py: 1 }}>
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, py: 1 }}>
                            {formatCurrency(entry.balance)}
                        </TableCell>
                        <TableCell align="right" sx={{ '@media print': { display: 'none' }, py: 1 }}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Edit Entry">
                                <IconButton 
                                    onClick={() => handleOpen(entry)} 
                                    size="small" 
                                    sx={{ 
                                        bgcolor: alpha(theme.palette.primary.main, 0.1), 
                                        color: 'primary.main', 
                                        padding: 0.5,
                                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } 
                                    }}
                                >
                                    <EditIcon fontSize="small" sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Entry">
                                <IconButton 
                                    onClick={() => handleDelete(entry._id)} 
                                    size="small" 
                                    sx={{ 
                                        bgcolor: alpha(theme.palette.error.main, 0.1), 
                                        color: 'error.main', 
                                        padding: 0.5,
                                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } 
                                    }}
                                >
                                    <DeleteIcon fontSize="small" sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                                <BookIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                                <Typography variant="subtitle1" color="text.secondary">No ledger entries found</Typography>
                                <Typography variant="body2" color="text.secondary">Try adjusting your filters or add a new entry.</Typography>
                                {entries.length === 0 && (
                                    <Button 
                                        variant="contained" 
                                        size="small"
                                        startIcon={<AddIcon />} 
                                        onClick={() => handleOpen()}
                                        sx={{ mt: 1, textTransform: 'none' }}
                                    >
                                        Add your first entry
                                    </Button>
                                )}
                            </Box>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </TableContainer>
      </div>
      
      <style>{`
            @media print {
                body * {
                    visibility: hidden;
                }
                #printable-ledger, #printable-ledger * {
                    visibility: visible;
                }
                #printable-ledger {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 20px;
                }
                @page {
                    margin: 1cm;
                }
            }
      `}</style>

      <Dialog 
        open={open} 
        onClose={handleClose}
        PaperProps={{
            sx: { borderRadius: 4, p: 1 }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>{currentEntry ? 'Edit Entry' : 'Add Ledger Entry'}</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
                label="Date"
                type="date"
                fullWidth
                value={formData.date}
                onChange={handleChange}
                name="date"
                InputLabelProps={{ shrink: true }}
                variant="outlined"
            />
            <TextField
                label="Description"
                type="text"
                fullWidth
                value={formData.description}
                onChange={handleChange}
                name="description"
                variant="outlined"
            />
            <TextField
                label="Reference (Optional)"
                type="text"
                fullWidth
                value={formData.reference}
                onChange={handleChange}
                name="reference"
                variant="outlined"
            />
            <FormControl fullWidth>
                <InputLabel>Account</InputLabel>
                <Select
                    value={formData.accountName}
                    label="Account"
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    name="accountName"
                >
                    {accountOptions.map(option => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Grid container spacing={2}>
                <Grid item xs={6}>
                    <TextField
                        select
                        label="Type"
                        fullWidth
                        value={formData.type}
                        onChange={handleChange}
                        name="type"
                        variant="outlined"
                    >
                        <MenuItem value="debit">Debit</MenuItem>
                        <MenuItem value="credit">Credit</MenuItem>
                    </TextField>
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        label="Amount"
                        type="number"
                        fullWidth
                        value={formData.amount}
                        onChange={handleChange}
                        name="amount"
                        variant="outlined"
                        InputProps={{
                            startAdornment: <Typography color="text.secondary" mr={1}>PKR</Typography>
                        }}
                    />
                </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} size="large" color="inherit" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" size="large" sx={{ borderRadius: 2, px: 4 }} disabled={loading}>
            {loading ? 'Saving...' : (currentEntry ? 'Save Changes' : 'Add Entry')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MANUAL JOURNAL (JV) DIALOG */}
      <Dialog 
        open={journalOpen} 
        onClose={() => setJournalOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Manual Journal Voucher (JV)
          <Typography variant="caption" color="text.secondary">Double-Entry Accounting</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 3, mt: 0.5 }}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                size="small"
                value={journalData.date}
                onChange={(e) => setJournalOpenData({ ...journalData, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Reference / JV #"
                fullWidth
                size="small"
                value={journalData.reference}
                onChange={(e) => setJournalOpenData({ ...journalData, reference: e.target.value })}
                placeholder="e.g. JV-001"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Overall Description"
                fullWidth
                size="small"
                value={journalData.description}
                onChange={(e) => setJournalOpenData({ ...journalData, description: e.target.value })}
              />
            </Grid>
          </Grid>

          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Account</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Debit (PKR)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Credit (PKR)</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Line Description</TableCell>
                <TableCell sx={{ width: '5%' }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {journalData.lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Autocomplete
                      options={accounts || []}
                      getOptionLabel={(option) => option.name}
                      value={accounts?.find(a => a.name === line.accountName) || null}
                      onChange={(e, val) => handleJournalLineChange(index, 'accountName', val?.name || '')}
                      renderInput={(params) => <TextField {...params} size="small" placeholder="Select Account" />}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={line.debit}
                      onChange={(e) => handleJournalLineChange(index, 'debit', e.target.value)}
                      disabled={!!line.credit}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={line.credit}
                      onChange={(e) => handleJournalLineChange(index, 'credit', e.target.value)}
                      disabled={!!line.debit}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={line.description}
                      onChange={(e) => handleJournalLineChange(index, 'description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => removeJournalLine(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button startIcon={<AddIcon />} onClick={addJournalLine} size="small">Add Line</Button>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="subtitle2" color={
                Math.abs(journalData.lines.reduce((s, l) => s + Number(l.debit || 0), 0) - 
                journalData.lines.reduce((s, l) => s + Number(l.credit || 0), 0)) < 0.01 ? 'success.main' : 'error.main'
              }>
                Difference: PKR {(journalData.lines.reduce((s, l) => s + Number(l.debit || 0), 0) - 
                                journalData.lines.reduce((s, l) => s + Number(l.credit || 0), 0)).toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setJournalOpen(false)} color="inherit" disabled={loading}>Cancel</Button>
          <Button 
            onClick={handleJournalSubmit} 
            variant="contained" 
            disabled={loading || Math.abs(journalData.lines.reduce((s, l) => s + Number(l.debit || 0), 0) - journalData.lines.reduce((s, l) => s + Number(l.credit || 0), 0)) > 0.01}
          >
            {loading ? 'Posting...' : 'Post Journal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Ledger;
