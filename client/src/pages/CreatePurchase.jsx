import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createPurchase } from '../redux/purchaseSlice';
import { getTeachers } from '../redux/teacherSlice';
import { getCourses } from '../redux/courseSlice';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Button, TextField, Grid, IconButton, Table, TableBody,
  TableCell, TableHead, TableRow, Box, Autocomplete, Divider, Card,
  CardContent, useTheme, TableContainer, alpha, InputAdornment,
  CircularProgress, FormControl, InputLabel, Select, MenuItem, Chip,
  Alert, Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon, Add as AddIcon, Save as SaveIcon,
  ArrowBack as ArrowBackIcon, Inventory as InventoryIcon,
  ReceiptLong as ReceiptLongIcon, Category as CategoryIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import moment from 'moment';
import { toast } from 'react-toastify';

const CATEGORY_OPTIONS = [
  { value: 'teacher_payment', label: 'Teacher Payment (Bill)', icon: '👨‍🏫', color: 'primary', desc: 'Dr Institute Assets/Expenses  ·  Cr Accounts Payable' },
  { value: 'expense', label: 'General Expense', icon: '🧾', color: 'warning', desc: 'Dr Expense Account  ·  Cr Cash / Bank / Payable' },
  { value: 'asset', label: 'Asset Purchase', icon: '🏢', color: 'success', desc: 'Dr Asset Account  ·  Cr Cash / Bank / Payable  →  Auto creates Asset' },
];

const PAYMENT_METHODS = ['Cash', 'Bank', 'Credit'];
const EXPENSE_ACCOUNTS = ['Operating Expenses', 'Salary Expense', 'Rent Expense', 'Utility Expense', 'Marketing Expense', 'Financial Expense', 'Other Expense'];
const ASSET_ACCOUNTS = ['Equipment', 'Furniture', 'Vehicles', 'Computer Equipment', 'Building', 'Land'];
const ASSET_CATEGORIES = ['Fixed Asset', 'IT Equipment', 'Furniture', 'Vehicles', 'Buildings', 'Other'];

const CreatePurchase = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId } = useParams();
  const theme = useTheme();

  const { teachers = [] } = useSelector((state) => state.teachers);
  const { courses = [] } = useSelector((state) => state.courses);

  const [category, setCategory] = useState('teacher_payment');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    teacherId: '',
    supplier: '',
    description: '',
    paymentMethod: 'Credit',
    expenseAccountName: 'Operating Expenses',
    // Asset-specific
    assetName: '',
    assetCategory: 'Fixed Asset',
    assetAccountName: 'Equipment',
    usefulLifeMonths: 60,
    salvageValue: 0,
    // Common
    date: moment().format('YYYY-MM-DD'),
    dueDate: '',
    items: [{ description: '', quantity: 1, price: 0, discount: 0, amount: 0, course: null }],
    taxRate: 0,
    cashDiscount: 0,
    notes: '',
  });

  useEffect(() => {
    if (companyId) {
      dispatch(getTeachers({ companyId }));
      dispatch(getCourses(companyId));
    }
  }, [dispatch, companyId]);

  const handleItemChange = (index, field, value) => {
    const items = [...form.items];
    items[index][field] = value;
    if (['quantity', 'price', 'discount'].includes(field)) {
      items[index].amount = Number(items[index].quantity || 0) * Number(items[index].price || 0) - Number(items[index].discount || 0);
    }
    setForm({ ...form, items });
  };

  const handleCourseSelect = (index, course) => {
    const items = [...form.items];
    items[index].course = course;
    if (course) {
      items[index].description = items[index].description || course.name || '';
      if (!items[index].price) items[index].price = Number(course.fee || 0);
      items[index].amount = Number(items[index].quantity || 1) * Number(items[index].price || 0) - Number(items[index].discount || 0);
    }
    setForm({ ...form, items });
  };

  const subTotal = form.items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const taxAmount = (Math.max(0, subTotal - Number(form.cashDiscount || 0)) * Number(form.taxRate || 0)) / 100;
  const total = Math.max(0, subTotal - Number(form.cashDiscount || 0)) + taxAmount;

  const getJournalPreview = () => {
    const cr = form.paymentMethod === 'Credit' ? 'Accounts Payable' : form.paymentMethod;
    if (category === 'teacher_payment') return `Dr Institute Assets/Expenses  ${total.toFixed(0)}  |  Cr ${cr}  ${total.toFixed(0)}`;
    if (category === 'expense') return `Dr ${form.expenseAccountName}  ${total.toFixed(0)}  |  Cr ${cr}  ${total.toFixed(0)}`;
    return `Dr ${form.assetAccountName}  ${total.toFixed(0)}  |  Cr ${cr}  ${total.toFixed(0)}  →  Asset Record Auto-Created`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (category === 'teacher_payment' && !form.teacherId) return toast.error('Please select a teacher');
    if (category !== 'teacher_payment' && !form.description && !form.supplier) return toast.error('Please enter a description or supplier');
    if (form.items.some((i) => !i.description || Number(i.amount) <= 0)) return toast.error('All items must have description and amount > 0');

    setLoading(true);
    try {
      const payload = {
        companyId, category,
        teacherId: form.teacherId || undefined,
        supplier: form.supplier,
        description: form.description,
        paymentMethod: form.paymentMethod,
        expenseAccountName: form.expenseAccountName,
        assetName: form.assetName || form.description,
        assetCategory: form.assetCategory,
        assetAccountName: form.assetAccountName,
        usefulLifeMonths: Number(form.usefulLifeMonths || 60),
        salvageValue: Number(form.salvageValue || 0),
        date: form.date,
        dueDate: form.dueDate || undefined,
        items: form.items.map((i) => ({
          course: i.course?._id || null,
          description: i.description,
          quantity: Number(i.quantity || 1),
          price: Number(i.price || 0),
          discount: Number(i.discount || 0),
          amount: Number(i.amount || 0),
        })),
        taxRate: Number(form.taxRate || 0),
        cashDiscount: Number(form.cashDiscount || 0),
        notes: form.notes,
      };

      await dispatch(createPurchase(payload)).unwrap();
      toast.success(`${category === 'asset' ? 'Asset purchase recorded + asset created!' : 'Purchase recorded successfully!'}`);
      navigate(`/company/${companyId}/purchases`);
    } catch (err) {
      toast.error(err?.message || 'Failed to record purchase');
    } finally {
      setLoading(false);
    }
  };

  const catInfo = CATEGORY_OPTIONS.find((c) => c.value === category);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
        <Box>
          <Typography variant="h5" fontWeight={800}>New Purchase / Bill</Typography>
          <Typography variant="body2" color="text.secondary">Record an expense, teacher bill, or asset purchase</Typography>
        </Box>
      </Box>

      {/* Category Selector */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CATEGORY_OPTIONS.map((opt) => (
          <Grid item xs={12} sm={4} key={opt.value}>
            <Card
              onClick={() => setCategory(opt.value)}
              sx={{
                cursor: 'pointer', borderRadius: 3, border: 2,
                borderColor: category === opt.value ? `${opt.color}.main` : 'divider',
                bgcolor: category === opt.value ? alpha(theme.palette[opt.color]?.main || '#1976d2', 0.06) : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': { borderColor: `${opt.color}.main`, boxShadow: 3 },
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography fontWeight={700} sx={{ mb: 0.5 }}>{opt.icon} {opt.label}</Typography>
                <Typography variant="caption" color="text.secondary">{opt.desc}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>Journal Preview:</strong> {getJournalPreview()}
      </Alert>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>

            {/* Header Fields */}
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  {category === 'teacher_payment' ? '👨‍🏫 Teacher Details' : category === 'asset' ? '🏢 Asset Details' : '🧾 Expense Details'}
                </Typography>
                <Grid container spacing={2}>
                  {category === 'teacher_payment' && (
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        options={teachers}
                        getOptionLabel={(o) => o.name || ''}
                        onChange={(_, val) => setForm({ ...form, teacherId: val?._id || '' })}
                        renderInput={(params) => <TextField {...params} label="Select Teacher *" />}
                      />
                    </Grid>
                  )}
                  {category !== 'teacher_payment' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Supplier / Vendor" fullWidth value={form.supplier}
                          onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Description *" fullWidth required value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })} />
                      </Grid>
                    </>
                  )}
                  <Grid item xs={12} sm={6}>
                    <TextField label="Date *" type="date" fullWidth required value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Method</InputLabel>
                      <Select value={form.paymentMethod} label="Payment Method"
                        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                        {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  {category === 'expense' && (
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Expense Account</InputLabel>
                        <Select value={form.expenseAccountName} label="Expense Account"
                          onChange={(e) => setForm({ ...form, expenseAccountName: e.target.value })}>
                          {EXPENSE_ACCOUNTS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                  {category === 'asset' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Asset Name *" fullWidth required value={form.assetName}
                          onChange={(e) => setForm({ ...form, assetName: e.target.value })} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Asset Account</InputLabel>
                          <Select value={form.assetAccountName} label="Asset Account"
                            onChange={(e) => setForm({ ...form, assetAccountName: e.target.value })}>
                            {ASSET_ACCOUNTS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Asset Category</InputLabel>
                          <Select value={form.assetCategory} label="Asset Category"
                            onChange={(e) => setForm({ ...form, assetCategory: e.target.value })}>
                            {ASSET_CATEGORIES.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField label="Useful Life (months)" type="number" fullWidth value={form.usefulLifeMonths}
                          onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })}
                          inputProps={{ min: 1 }} helperText={`${Math.round(form.usefulLifeMonths / 12)} years`} />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField label="Salvage Value (PKR)" type="number" fullWidth value={form.salvageValue}
                          onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} inputProps={{ min: 0 }} />
                      </Grid>
                      {total > 0 && Number(form.usefulLifeMonths) > 0 && (
                        <Grid item xs={12}>
                          <Alert severity="success" sx={{ borderRadius: 2 }}>
                            <strong>Depreciation Preview (Straight Line):</strong>{' '}
                            Annual = PKR {(((total - Number(form.salvageValue || 0)) / Number(form.usefulLifeMonths || 60)) * 12).toFixed(0).toLocaleString()}{' '}
                            &nbsp;|&nbsp; Monthly = PKR {((total - Number(form.salvageValue || 0)) / Number(form.usefulLifeMonths || 60)).toFixed(0).toLocaleString()}
                          </Alert>
                        </Grid>
                      )}
                    </>
                  )}
                </Grid>
              </CardContent>
            </Card>

            {/* Items Table */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Line Items</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableRow>
                        {category === 'teacher_payment' && <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>}
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} width={80}>Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} width={120}>Price (PKR)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} width={100}>Disc (PKR)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }} width={120}>Amount</TableCell>
                        <TableCell width={50} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {form.items.map((item, idx) => (
                        <TableRow key={idx}>
                          {category === 'teacher_payment' && (
                            <TableCell>
                              <Autocomplete size="small" options={courses}
                                getOptionLabel={(o) => o.name || ''}
                                isOptionEqualToValue={(o, v) => o._id === v._id}
                                value={item.course}
                                onChange={(_, val) => handleCourseSelect(idx, val)}
                                renderInput={(params) => <TextField {...params} placeholder="Course" size="small" />}
                                sx={{ minWidth: 130 }}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <TextField size="small" fullWidth value={item.description} required
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              placeholder="Item description" />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" type="number" value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              inputProps={{ min: 0, style: { width: 60 } }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" type="number" value={item.price}
                              onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                              inputProps={{ min: 0, style: { width: 100 } }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" type="number" value={item.discount}
                              onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                              inputProps={{ min: 0, style: { width: 80 } }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {Number(item.amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" color="error"
                              onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                              disabled={form.items.length === 1}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1.5 }}
                  onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, price: 0, discount: 0, amount: 0, course: null }] })}>
                  Add Item
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Summary Panel */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, position: 'sticky', top: 80 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Summary</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography color="text.secondary">Subtotal</Typography>
                  <Typography fontWeight={600}>PKR {subTotal.toLocaleString()}</Typography>
                </Box>
                <TextField label="Tax Rate (%)" type="number" fullWidth size="small" sx={{ mb: 1.5 }}
                  value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                  inputProps={{ min: 0, max: 100 }} />
                <TextField label="Cash Discount (PKR)" type="number" fullWidth size="small" sx={{ mb: 1.5 }}
                  value={form.cashDiscount} onChange={(e) => setForm({ ...form, cashDiscount: e.target.value })}
                  inputProps={{ min: 0 }} />
                {taxAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="text.secondary">Tax ({form.taxRate}%)</Typography>
                    <Typography>PKR {taxAmount.toLocaleString()}</Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight={800}>Total</Typography>
                  <Typography variant="h6" fontWeight={800} color="primary.main">
                    PKR {total.toLocaleString()}
                  </Typography>
                </Box>

                <TextField label="Notes" fullWidth multiline rows={2} size="small" sx={{ mb: 2 }}
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

                {form.paymentMethod === 'Credit' && (
                  <TextField label="Due Date" type="date" fullWidth size="small" sx={{ mb: 2 }}
                    value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    InputLabelProps={{ shrink: true }} />
                )}

                {category === 'asset' && (
                  <Chip icon={<InventoryIcon />} label="Asset Record Will Be Created Automatically" color="success" size="small" sx={{ mb: 2, width: '100%' }} />
                )}

                <Button type="submit" variant="contained" fullWidth size="large"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                  disabled={loading} sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}>
                  {loading ? 'Saving...' : `Record ${catInfo?.label}`}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default CreatePurchase;
