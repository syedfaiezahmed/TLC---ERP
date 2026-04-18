import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  InputAdornment,
  Chip,
  alpha,
  useTheme,
  Avatar,
  Snackbar,
  Stack,
  Tooltip
} from '@mui/material';
import { TableRowSkeleton } from '../components/SkeletonLoaders';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  ReceiptLong as ReceiptIcon,
  AttachMoney as MoneyIcon,
  Event as EventIcon,
  Description as DescriptionIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { getExpenses, createExpense, deleteExpense, clearExpenseError } from '../redux/expenseSlice';
import { getExpenseCategories, createExpenseCategory, deleteExpenseCategory, clearCategoryError } from '../redux/expenseCategorySlice';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import moment from 'moment';
import DownloadIcon from '@mui/icons-material/Download';

const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Other'];

const Expenses = () => {
  const { companyId } = useParams();
  const dispatch = useDispatch();
  const theme = useTheme();
  
  const { expenses, totalAmount, loading, saveLoading, saveError } = useSelector((state) => state.expenses);
  const { categories: dynamicCategories, loading: catLoading, error: categoryError } = useSelector((state) => state.expenseCategories);
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', code: '', description: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(moment().startOf('month').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(moment().endOf('month').format('YYYY-MM-DD'));
  const [filterCategory, setFilterCategory] = useState('all');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [formData, setFormData] = useState({
    date: moment().format('YYYY-MM-DD'),
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'Cash',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    if (companyId) {
      dispatch(getExpenses({ companyId, params: { startDate: dateFrom, endDate: dateTo, category: filterCategory !== 'all' ? filterCategory : undefined } }));
      dispatch(getExpenseCategories(companyId));
    }
  }, [dispatch, companyId, dateFrom, dateTo, filterCategory]);

  useEffect(() => {
    if (dynamicCategories.length > 0 && !formData.category) {
      setFormData(prev => ({ ...prev, category: dynamicCategories[0].name }));
    }
  }, [dynamicCategories]);

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const resetForm = () => {
    setFormData({
      date: moment().format('YYYY-MM-DD'),
      description: '',
      amount: '',
      category: dynamicCategories[0]?.name || '',
      paymentMethod: 'Cash',
      reference: '',
      notes: ''
    });
    dispatch(clearExpenseError());
  };

  const handleOpen = () => { resetForm(); setOpen(true); };
  const handleClose = () => { setOpen(false); resetForm(); };

  const handleCategoryOpen = () => setCategoryOpen(true);
  const handleCategoryClose = () => {
    setCategoryOpen(false);
    setNewCategory({ name: '', code: '', description: '' });
    dispatch(clearCategoryError());
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      showSnack('Category name is required', 'error');
      return;
    }
    const result = await dispatch(createExpenseCategory({ ...newCategory, companyId }));
    if (!result.error) {
      showSnack(`Category "${newCategory.name}" added successfully`);
      setFormData(prev => ({ ...prev, category: newCategory.name.trim() }));
      setNewCategory({ name: '', code: '', description: '' });
    } else {
      showSnack(result.payload?.message || 'Failed to add category', 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      const result = await dispatch(deleteExpenseCategory(id));
      if (!result.error) {
        showSnack('Category deleted');
      } else {
        showSnack(result.payload?.message || 'Cannot delete category', 'error');
      }
    }
  };

  const handleChange = (e) => {
    if (e.target.name === 'category' && e.target.value === 'ADD_NEW') {
      handleCategoryOpen();
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.category) {
      showSnack('Please select a category', 'error');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      showSnack('Amount must be greater than 0', 'error');
      return;
    }
    if (!formData.description.trim()) {
      showSnack('Description is required', 'error');
      return;
    }

    const selectedCat = dynamicCategories.find(c => c.name === formData.category);
    const result = await dispatch(createExpense({ 
      ...formData,
      amount: Number(formData.amount),
      companyId,
      categoryCode: selectedCat?.code || '',
      accountName: formData.category,
    }));

    if (!result.error) {
      showSnack('Expense recorded successfully! Journal entry posted.');
      handleClose();
      dispatch(getExpenses({ companyId }));
    } else {
      showSnack(result.payload?.message || 'Failed to record expense', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this expense? This will also reverse the journal entry.')) {
      const result = await dispatch(deleteExpense(id));
      if (!result.error) {
        showSnack('Expense deleted and journal reversed');
      } else {
        showSnack(result.payload?.message || 'Failed to delete expense', 'error');
      }
    }
  };

  const filteredExpenses = (expenses || []).filter(exp =>
    (exp.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exp.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = (type) => {
    const columns = [
      { header: 'Date', key: 'date', format: 'date' },
      { header: 'Category', key: 'category' },
      { header: 'Description', key: 'description' },
      { header: 'Payment Method', key: 'paymentMethod' },
      { header: 'Reference', key: 'reference' },
      { header: 'Amount', key: 'amount', format: 'currency', align: 'right', sum: true }
    ];

    const title = 'Expenses Report';
    const dateLabel = `As of ${moment().format('MMM D, YYYY')}`;

    if (type === 'excel') {
      exportToExcel(filteredExpenses, columns, title, dateLabel, 'TLC ERP');
    } else {
      exportToPDF(filteredExpenses, columns, title, dateLabel, 'TLC ERP', theme.palette.primary.main);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* Snackbar Notification */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Expenses
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your company's expenditures and track categories.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
            startIcon={<CategoryIcon />}
            onClick={handleCategoryOpen}
            sx={{ borderRadius: 2, px: 3, py: 1.2, fontWeight: 600 }}
          >
            Add Category
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpen}
            sx={{ borderRadius: 2, px: 3, py: 1.2, fontWeight: 600 }}
          >
            Record Expense
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[2] }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', mr: 2 }}>
                  <MoneyIcon />
                </Avatar>
                <Typography variant="h6" fontWeight={700}>Total Expenses</Typography>
              </Box>
              <Typography variant="h3" fontWeight={800} color="error.main">
                PKR {(totalAmount || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[2], overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderBottom: `1px solid ${theme.palette.divider}` }}>
          <TextField
            size="small"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 200 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
          />
          <TextField size="small" label="From" type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <TextField size="small" label="To" type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <TextField select size="small" label="Category" value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">All Categories</MenuItem>
            {(dynamicCategories || []).map(c => <MenuItem key={c._id} value={c.name}>{c.name}</MenuItem>)}
          </TextField>
        </Box>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowSkeleton rows={8} cols={7} />
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No expenses found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((exp) => (
                  <TableRow key={exp._id} hover>
                    <TableCell>{moment(exp.date).format('DD MMM YYYY')}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Chip
                          label={exp.category}
                          size="small"
                          sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', mb: 0.5, width: 'fit-content' }}
                        />
                        {exp.categoryCode && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, ml: 0.5 }}>
                            {exp.categoryCode}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{exp.description}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{exp.paymentMethod}</Typography>
                      {exp.reference && <Typography variant="caption" color="text.secondary">{exp.reference}</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                      PKR {(exp.amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => handleDelete(exp._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Record Expense Dialog ──────────────────────────────────────────── */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800, pt: 3, px: 3 }}>Record New Expense</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ p: 3 }}>
            {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date"
                  type="date"
                  fullWidth
                  required
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Amount (PKR)"
                  type="number"
                  fullWidth
                  required
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  inputProps={{ min: 1, step: 'any' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Category"
                  fullWidth
                  required
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  helperText={dynamicCategories.length === 0 ? 'No categories yet — add one first' : ''}
                >
                  {dynamicCategories.map((option) => (
                    <MenuItem key={option._id} value={option.name}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Typography variant="body2">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.code}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  <MenuItem value="ADD_NEW" sx={{ borderTop: '1px solid', borderColor: 'divider', fontWeight: 600, color: 'primary.main' }}>
                    + Add New Category
                  </MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Payment Method"
                  fullWidth
                  required
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                >
                  {paymentMethods.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  required
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="e.g. Monthly Office Rent"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Reference / Voucher #"
                  fullWidth
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notes"
                  fullWidth
                  multiline
                  rows={2}
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                />
              </Grid>
            </Grid>
            {formData.category && formData.amount > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Journal Preview:</strong> Dr {formData.category} {Number(formData.amount).toLocaleString()} / Cr {formData.paymentMethod === 'Cash' ? 'Cash' : 'Bank'} {Number(formData.amount).toLocaleString()}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleClose} size="large" color="inherit" disabled={saveLoading}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              sx={{ borderRadius: 2, px: 4 }}
              disabled={saveLoading || !formData.category || !formData.amount || !formData.description}
            >
              {saveLoading ? <><CircularProgress size={20} sx={{ mr: 1 }} /> Saving...</> : 'Save Expense'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Category Management Dialog ─────────────────────────────────────── */}
      <Dialog open={categoryOpen} onClose={handleCategoryClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800, pt: 3 }}>Expense Categories (Chart of Accounts)</DialogTitle>
        <DialogContent>
          {categoryError && <Alert severity="error" sx={{ mb: 2 }}>{categoryError}</Alert>}
          
          <Typography variant="subtitle2" gutterBottom fontWeight={700}>Add New Category</Typography>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={4}>
              <TextField
                label="Code"
                fullWidth
                size="small"
                value={newCategory.code}
                onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value })}
                placeholder="e.g. 6001"
              />
            </Grid>
            <Grid item xs={8}>
              <TextField
                label="Category Name"
                fullWidth
                size="small"
                required
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g. Rent Expense"
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                onClick={handleAddCategory}
                variant="contained"
                fullWidth
                disabled={!newCategory.name.trim() || catLoading}
                sx={{ borderRadius: 2 }}
              >
                {catLoading ? <CircularProgress size={20} /> : 'Add Category'}
              </Button>
            </Grid>
          </Grid>

          <Typography variant="subtitle2" gutterBottom fontWeight={700}>Existing Categories</Typography>
          <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dynamicCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">No categories yet. Add your first one above.</Typography>
                    </TableCell>
                  </TableRow>
                ) : dynamicCategories.map((cat) => (
                  <TableRow key={cat._id} hover>
                    <TableCell>{cat.code}</TableCell>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => handleDeleteCategory(cat._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={handleCategoryClose} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Expenses;
