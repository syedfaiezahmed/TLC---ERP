import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
  alpha,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Search as SearchIcon, ReceiptLong as ReceiptLongIcon } from '@mui/icons-material';
import moment from 'moment';
import { toast } from 'react-toastify';
import { getTeachers } from '../redux/teacherSlice';
import { getCourses } from '../redux/courseSlice';
import { getPurchases } from '../redux/purchaseSlice';
import { getPurchaseReturns, createPurchaseReturn, deletePurchaseReturn } from '../redux/purchaseReturnSlice';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

const PurchaseReturns = () => {
  const { companyId } = useParams();
  const dispatch = useDispatch();
  const theme = useTheme();

  const { teachers } = useSelector((state) => state.teachers);
  const { courses } = useSelector((state) => state.courses);
  const { returns, loading } = useSelector((state) => state.purchaseReturns);
  const { purchases } = useSelector((state) => state.purchases);

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  
  const [teacher, setTeacher] = useState(null);
  const [purchase, setPurchase] = useState(null);
  const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
  const [taxRate, setTaxRate] = useState(0);
  const [reason, setReason] = useState('');
  const [items, setItems] = useState([{ course: null, description: '', quantity: 1, price: 0, amount: 0 }]);

  const subTotal = useMemo(() => items.reduce((s, i) => s + Number(i.amount || 0), 0), [items]);
  const taxAmount = useMemo(() => (subTotal * Number(taxRate || 0)) / 100, [subTotal, taxRate]);
  const totalAmount = useMemo(() => subTotal + taxAmount, [subTotal, taxAmount]);

  useEffect(() => {
    if (!companyId) return;
    dispatch(getTeachers({ companyId, params: { page: 1, limit: 1000, search: '' } }));
    dispatch(getCourses(companyId));
    dispatch(getPurchaseReturns(companyId));
    dispatch(getPurchases({ companyId, page: 1, limit: 1000 }));
  }, [dispatch, companyId]);

  const filteredPurchases = useMemo(() => {
    if (!teacher || !purchases) return [];
    return purchases.filter(p => 
        (p.teacher?._id === teacher._id || p.teacher === teacher._id) && 
        p.status !== 'paid'
    );
  }, [teacher, purchases]);

  const remainingBalance = useMemo(() => {
    if (!purchase) return 0;
    return Number((purchase.totalAmount - (purchase.debitNoteAmount || 0)).toFixed(2));
  }, [purchase]);

  const ledgerImpact = useMemo(() => {
    if (totalAmount <= 0) return [];
    return [
      { account: 'Accounts Payable', type: 'Dr', amount: totalAmount, description: 'Reduce Payable' },
      { account: 'Institute Assets/Expenses', type: 'Cr', amount: subTotal, description: 'Reverse Expense' },
      ...(taxAmount > 0 ? [{ account: 'Input Tax', type: 'Cr', amount: taxAmount, description: 'Reverse Tax' }] : []),
    ];
  }, [subTotal, taxAmount, totalAmount]);

  const handlePurchaseChange = (e, val) => {
    setPurchase(val);
    if (val && val.items) {
      setItems(val.items.map(item => ({
        course: item.course,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        amount: item.amount
      })));
      setTaxRate(val.taxRate || 0);
    }
  };

  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return returns || [];
    return (returns || []).filter((n) => 
        `${n.returnNumber}`.includes(q) || 
        (n.teacher?.name || '').toLowerCase().includes(q) ||
        (n.reason || '').toLowerCase().includes(q)
    );
  }, [returns, search]);

  const resetForm = () => {
    setTeacher(null);
    setPurchase(null);
    setDate(moment().format('YYYY-MM-DD'));
    setTaxRate(0);
    setReason('');
    setItems([{ course: null, description: '', quantity: 1, price: 0, amount: 0 }]);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const updateItem = (idx, patch) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    const qty = Number(next[idx].quantity || 0);
    const price = Number(next[idx].price || 0);
    next[idx].amount = Number((qty * price).toFixed(2));
    setItems(next);
  };

  const addLine = () => setItems([...items, { course: null, description: '', quantity: 1, price: 0, amount: 0 }]);
  const removeLine = (idx) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teacher) return toast.error('Please select teacher');
    if (items.some((i) => !i.description || Number(i.quantity) <= 0 || Number(i.price) < 0)) return toast.error('Please check items');
    
    try {
      const result = await dispatch(createPurchaseReturn({
        companyId,
        teacherId: teacher._id,
        purchaseId: purchase?._id || null,
        date,
        reason,
        taxRate: Number(taxRate || 0),
        items: items.map((i) => ({
          course: i.course?._id || null,
          description: i.description,
          quantity: Number(i.quantity),
          price: Number(i.price),
          amount: Number(i.amount),
        })),
      }));

      if (!result.error) {
        toast.success('Purchase return created');
        handleClose();
      } else {
        toast.error(result.payload?.message || 'Failed to create return');
      }
    } catch (err) {
      toast.error('An error occurred');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to void this return record?')) {
      const result = await dispatch(deletePurchaseReturn(id));
      if (!result.error) {
        toast.success('Return record deleted');
      } else {
        toast.error(result.payload?.message || 'Failed to delete');
      }
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader
        title="Purchase Returns"
        subtitle="Reduce teacher payable and reverse bill for adjustments."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen} sx={{ borderRadius: 2, px: 3, py: 1.2 }}>
            Create Purchase Return
          </Button>
        }
      />

      <SectionCard>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search returns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 320 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Return #</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Teacher</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reference Bill</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : filteredReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No returns found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReturns.map((n) => (
                  <TableRow key={n._id} hover>
                    <TableCell sx={{ fontWeight: 700 }}>#{n.returnNumber}</TableCell>
                    <TableCell>{moment(n.date).format('DD MMM YYYY')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{n.teacher?.name}</TableCell>
                    <TableCell>
                        {n.purchase ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ReceiptLongIcon fontSize="inherit" color="action" />
                                <Typography variant="body2">Bill #{n.purchase.purchaseNumber}</Typography>
                            </Box>
                        ) : '-'}
                    </TableCell>
                    <TableCell>{n.reason || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      PKR {Number(n.totalAmount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                        <Tooltip title="Void Return">
                            <IconButton size="small" color="error" onClick={() => handleDelete(n._id)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Purchase Return</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ p: 3 }}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={teachers || []}
                  getOptionLabel={(o) => o.name}
                  value={teacher}
                  onChange={(e, v) => {
                      setTeacher(v);
                      setPurchase(null);
                  }}
                  renderInput={(params) => <TextField {...params} label="Teacher" required />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={filteredPurchases}
                  getOptionLabel={(o) => `Bill #${o.purchaseNumber} (Bal: PKR ${o.balanceDue.toLocaleString()})`}
                  value={purchase}
                  disabled={!teacher}
                  onChange={handlePurchaseChange}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Link to Bill (Optional)" 
                      helperText={purchase ? `Max Returnable: PKR ${remainingBalance.toLocaleString()}` : ""}
                      error={purchase && totalAmount > remainingBalance}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="date" label="Date" fullWidth required value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField label="Reason / Notes" fullWidth value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Service cancellation" />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="number" label="Tax Rate (%)" fullWidth value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Course (Optional)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} width={100}>Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} width={140}>Fee/Cost</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }} width={140}>Amount</TableCell>
                    <TableCell align="center" width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Autocomplete
                          options={courses || []}
                          getOptionLabel={(o) => o.name}
                          value={line.course}
                          onChange={(e, v) => updateItem(idx, { course: v, description: v ? v.name : line.description, price: v ? (v.fee || v.price) : line.price })}
                          renderInput={(params) => <TextField {...params} size="small" placeholder="Select" />}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" fullWidth value={line.description} onChange={(e) => updateItem(idx, { description: e.target.value })} required />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" fullWidth value={line.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} required />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" fullWidth value={line.price} onChange={(e) => updateItem(idx, { price: e.target.value })} required />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>PKR {Number(line.amount || 0).toLocaleString()}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => removeLine(idx)} disabled={items.length === 1}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Button onClick={addLine} startIcon={<AddIcon />} sx={{ mt: 2 }} size="small">
              Add Line
            </Button>

            <Divider sx={{ my: 2 }} />

            {totalAmount > 0 && (
              <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptLongIcon fontSize="small" color="info" />
                  Real-time Ledger Impact Preview
                </Typography>
                <Grid container spacing={1}>
                  {ledgerImpact.map((l, i) => (
                    <Grid item xs={12} key={i}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{l.account} ({l.description})</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: l.type === 'Dr' ? 'success.main' : 'error.main' }}>
                          {l.type} PKR {l.amount.toLocaleString()}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Subtotal</Typography>
                <Typography variant="body1" fontWeight={700}>PKR {subTotal.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Tax ({taxRate}%)</Typography>
                <Typography variant="body1" fontWeight={700}>PKR {taxAmount.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Total Return</Typography>
                <Typography variant="h6" fontWeight={900} color="primary.main">PKR {totalAmount.toLocaleString()}</Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={handleClose} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ borderRadius: 2, px: 4 }}>
              Create Purchase Return
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default PurchaseReturns;
