import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  MoneyOff as MoneyOffIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import moment from 'moment';
import { toast } from 'react-toastify';
import { getStudents } from '../redux/studentSlice';
import { getCourses } from '../redux/courseSlice';
import { getFees } from '../redux/feeSlice';
import {
  createFeeRefund,
  deleteFeeRefund,
  getFeeRefunds,
  getPaymentHistory,
  refundFeePayment,
} from '../redux/feeRefundSlice';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

// ─── Status Chip helper ───────────────────────────────────────────────────────
const PayStatusChip = ({ status }) => {
  const map = {
    active: { label: 'Active', color: 'success' },
    refunded: { label: 'Refunded', color: 'error' },
    partial: { label: 'Partial', color: 'warning' },
  };
  const s = map[status] || { label: status, color: 'default' };
  return <Chip label={s.label} color={s.color} size="small" />;
};

const FeeRefunds = () => {
  const { companyId } = useParams();
  const dispatch = useDispatch();
  const theme = useTheme();

  const { students } = useSelector((state) => state.students);
  const { courses } = useSelector((state) => state.courses);
  const { refunds, loading, payments, paymentsLoading } = useSelector((state) => state.feeRefunds);
  const { fees } = useSelector((state) => state.fees);

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');

  // ── Tab 1: Fee Refund form state ──────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState(null);
  const [fee, setFee] = useState(null);
  const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
  const [taxRate, setTaxRate] = useState(0);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [items, setItems] = useState([{ course: null, description: '', quantity: 1, price: 0, amount: 0 }]);

  // ── Tab 2: Payment Refund state ───────────────────────────────────────────
  const [payStudent, setPayStudent] = useState(null);
  const [paySearch, setPaySearch] = useState('');
  const [refundDialog, setRefundDialog] = useState({ open: false, payment: null });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const subTotal = useMemo(() => items.reduce((s, i) => s + Number(i.amount || 0), 0), [items]);
  const taxAmount = useMemo(() => (subTotal * Number(taxRate || 0)) / 100, [subTotal, taxRate]);
  const totalAmount = useMemo(() => subTotal + taxAmount, [subTotal, taxAmount]);

  useEffect(() => {
    if (!companyId) return;
    dispatch(getStudents({ companyId, page: 1, limit: 1000, search: '' }));
    dispatch(getCourses(companyId));
    dispatch(getFeeRefunds(companyId));
    dispatch(getFees({ companyId, page: 1, limit: 1000 }));
  }, [dispatch, companyId]);

  // Load payments when tab 2 student changes
  useEffect(() => {
    if (tab === 1 && payStudent) {
      dispatch(getPaymentHistory({ student: payStudent._id, limit: 200 }));
    }
  }, [tab, payStudent, dispatch]);

  // ── Tab 1 helpers ─────────────────────────────────────────────────────────
  const filteredFees = useMemo(() => {
    if (!student || !fees) return [];
    return fees.filter(
      (f) => (f.student?._id === student._id || f.student === student._id) && f.status !== 'unpaid'
    );
  }, [student, fees]);

  const remainingBalance = useMemo(() => {
    if (!fee) return 0;
    return Number((fee.totalAmount - (fee.refundAmount || 0)).toFixed(2));
  }, [fee]);

  const filteredRefunds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return refunds || [];
    return (refunds || []).filter(
      (n) =>
        `${n.refundNumber}`.includes(q) ||
        (n.student?.name || '').toLowerCase().includes(q) ||
        (n.reason || '').toLowerCase().includes(q)
    );
  }, [refunds, search]);

  const resetForm = () => {
    setStudent(null);
    setFee(null);
    setDate(moment().format('YYYY-MM-DD'));
    setTaxRate(0);
    setReason('');
    setRefundMethod('Cash');
    setItems([{ course: null, description: '', quantity: 1, price: 0, amount: 0 }]);
  };

  const updateItem = (idx, patch) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    next[idx].amount = Number((Number(next[idx].quantity || 0) * Number(next[idx].price || 0)).toFixed(2));
    setItems(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!student) return toast.error('Please select a student');
    if (items.some((i) => !i.description || Number(i.quantity) <= 0 || Number(i.price) < 0))
      return toast.error('Please fill all item fields correctly');

    const result = await dispatch(
      createFeeRefund({
        companyId,
        studentId: student._id,
        feeId: fee?._id || null,
        date,
        reason,
        refundMethod,
        taxRate: Number(taxRate || 0),
        items: items.map((i) => ({
          course: i.course?._id || null,
          description: i.description,
          quantity: Number(i.quantity),
          price: Number(i.price),
          amount: Number(i.amount),
        })),
      })
    );
    if (!result.error) {
      toast.success('Fee refund created successfully');
      setOpen(false);
      resetForm();
    } else {
      toast.error(result.payload?.message || 'Failed to create fee refund');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Void this refund record?')) return;
    const result = await dispatch(deleteFeeRefund(id));
    if (!result.error) toast.success('Refund voided');
    else toast.error(result.payload?.message || 'Failed to void');
  };

  // ── Tab 2 helpers ─────────────────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    return (payments || []).filter(
      (p) =>
        !q ||
        (p.paymentNumber || '').toLowerCase().includes(q) ||
        (p.voucher?.voucherNumber || '').toLowerCase().includes(q)
    );
  }, [payments, paySearch]);

  const openRefundDialog = (payment) => {
    setRefundDialog({ open: true, payment });
    setRefundAmount(String(payment.amount));
    setRefundReason('');
  };

  const handleRefundPayment = async () => {
    const amt = Number(refundAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid refund amount');
    if (!refundReason.trim()) return toast.error('Refund reason is required');
    if (amt > refundDialog.payment.amount)
      return toast.error(`Max refundable: PKR ${refundDialog.payment.amount.toLocaleString()}`);

    setRefunding(true);
    const result = await dispatch(
      refundFeePayment({
        paymentId: refundDialog.payment._id,
        refundAmount: amt,
        refundReason: refundReason.trim(),
      })
    );
    setRefunding(false);

    if (!result.error) {
      toast.success('Payment refunded successfully. Ledger updated.');
      setRefundDialog({ open: false, payment: null });
      if (payStudent) dispatch(getPaymentHistory({ student: payStudent._id, limit: 200 }));
    } else {
      toast.error(result.payload?.message || 'Failed to process refund');
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader
        title="Fee Refunds"
        subtitle="Refund fee receipts or collected payments. All refunds post to the General Ledger automatically."
        actions={
          tab === 0 ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { resetForm(); setOpen(true); }}
              sx={{ borderRadius: 2, px: 3, py: 1.2 }}
            >
              Create Fee Refund
            </Button>
          ) : null
        }
      />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <SectionCard sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: `1px solid ${theme.palette.divider}`, px: 2 }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon fontSize="small" />
                Fee Refunds (Classic)
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <UndoIcon fontSize="small" />
                Payment Refunds (Voucher System)
              </Box>
            }
          />
        </Tabs>

        {/* ── Tab 0: Classic Fee Refunds ──────────────────────────────────── */}
        {tab === 0 && (
          <>
            <Box
              sx={{
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <TextField
                size="small"
                placeholder="Search refunds…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ width: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {filteredRefunds.length} record(s)
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableRow>
                    {['Refund #', 'Date', 'Student', 'Linked Fee', 'Reason', 'Total', 'Actions'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700 }} align={h === 'Total' ? 'right' : h === 'Actions' ? 'center' : 'left'}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : filteredRefunds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                        <Typography color="text.secondary">No refunds found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRefunds.map((n) => (
                      <TableRow key={n._id} hover>
                        <TableCell sx={{ fontWeight: 700 }}>#{n.refundNumber}</TableCell>
                        <TableCell>{moment(n.date).format('DD MMM YYYY')}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{n.student?.name}</TableCell>
                        <TableCell>
                          {n.fee ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ReceiptIcon fontSize="inherit" color="action" />
                              <Typography variant="body2">Fee #{n.fee.feeNumber}</Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>{n.reason || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          PKR {Number(n.totalAmount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Void Refund">
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
          </>
        )}

        {/* ── Tab 1: Payment Refunds ──────────────────────────────────────── */}
        {tab === 1 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Select a student to view their collected payments. Refunding a payment will reverse the income entry in the General Ledger automatically.
            </Alert>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={students || []}
                  getOptionLabel={(o) => o.name}
                  value={payStudent}
                  onChange={(_, v) => setPayStudent(v)}
                  renderInput={(params) => <TextField {...params} label="Select Student" size="small" />}
                />
              </Grid>
              {payStudent && (
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    placeholder="Search by payment # or voucher #"
                    value={paySearch}
                    onChange={(e) => setPaySearch(e.target.value)}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              )}
            </Grid>

            {paymentsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={28} />
              </Box>
            ) : !payStudent ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <MoneyOffIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">Select a student to view collected payments.</Typography>
              </Box>
            ) : filteredPayments.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">No payments found for this student.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      {['Payment #', 'Date', 'Voucher', 'Method', 'Amount', 'Status', 'Action'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700 }} align={h === 'Amount' ? 'right' : h === 'Action' ? 'center' : 'left'}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPayments.map((p) => (
                      <TableRow key={p._id} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{p.paymentNumber}</TableCell>
                        <TableCell>{moment(p.paymentDate).format('DD MMM YYYY')}</TableCell>
                        <TableCell>
                          {p.voucher?.voucherNumber ? (
                            <Chip label={p.voucher.voucherNumber} size="small" variant="outlined" />
                          ) : '—'}
                        </TableCell>
                        <TableCell>{p.paymentMethod}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          PKR {Number(p.amount || 0).toLocaleString()}
                          {p.refundedAmount > 0 && (
                            <Typography variant="caption" color="error.main" display="block">
                              Refunded: PKR {Number(p.refundedAmount).toLocaleString()}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <PayStatusChip status={p.status} />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={p.status === 'refunded' ? 'Already refunded' : 'Refund this payment'}>
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<UndoIcon />}
                                disabled={p.status === 'refunded'}
                                onClick={() => openRefundDialog(p)}
                                sx={{ borderRadius: 1.5 }}
                              >
                                Refund
                              </Button>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </SectionCard>

      {/* ── Classic Fee Refund Dialog ──────────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Fee Refund</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ p: 3 }}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={students || []}
                  getOptionLabel={(o) => o.name}
                  value={student}
                  onChange={(_, v) => { setStudent(v); setFee(null); }}
                  renderInput={(params) => <TextField {...params} label="Student" required />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={filteredFees}
                  getOptionLabel={(o) => `Fee #${o.feeNumber} — PKR ${o.totalAmount?.toLocaleString()}`}
                  value={fee}
                  disabled={!student}
                  onChange={(_, v) => {
                    setFee(v);
                    if (v?.items) {
                      setItems(v.items.map((i) => ({ course: i.course, description: i.description, quantity: i.quantity, price: i.price, amount: i.amount })));
                      setTaxRate(v.taxRate || 0);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Link to Fee Receipt (Optional)"
                      helperText={fee ? `Max refundable: PKR ${remainingBalance.toLocaleString()}` : ''}
                      error={!!fee && totalAmount > remainingBalance}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="date" label="Date" fullWidth required value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField select label="Refund Method" fullWidth value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                  {['Cash', 'Bank Transfer', 'Cheque', 'Online'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="number" label="Tax Reversal Rate (%)" fullWidth value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Reason / Notes" fullWidth value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Withdrawal from course" />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Course (Optional)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} width={90}>Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} width={130}>Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }} width={130}>Amount</TableCell>
                    <TableCell width={50} />
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
                          onChange={(_, v) => updateItem(idx, { course: v, description: v ? v.name : line.description, price: v ? (v.fee || v.price || 0) : line.price })}
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
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        PKR {Number(line.amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Button onClick={() => setItems([...items, { course: null, description: '', quantity: 1, price: 0, amount: 0 }])} startIcon={<AddIcon />} sx={{ mt: 2 }} size="small">
              Add Line
            </Button>

            <Divider sx={{ my: 2 }} />

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
                <Typography variant="caption" color="text.secondary" display="block">Total Refund</Typography>
                <Typography variant="h6" fontWeight={900} color="primary.main">PKR {totalAmount.toLocaleString()}</Typography>
              </Box>
            </Box>

            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              This refund will post a journal entry: <strong>Dr Fee Revenue / Cr Accounts Receivable</strong> — visible in General Ledger.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => { setOpen(false); resetForm(); }} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" sx={{ borderRadius: 2, px: 4 }}>
              Create Fee Refund
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Payment Refund Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={refundDialog.open}
        onClose={() => setRefundDialog({ open: false, payment: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <UndoIcon color="error" />
          Refund Payment
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {refundDialog.payment && (
            <>
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.grey[500], 0.08), borderRadius: 2, mb: 3 }}>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Payment #</Typography>
                    <Typography fontWeight={700}>{refundDialog.payment.paymentNumber}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Date</Typography>
                    <Typography fontWeight={700}>{moment(refundDialog.payment.paymentDate).format('DD MMM YYYY')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Method</Typography>
                    <Typography fontWeight={700}>{refundDialog.payment.paymentMethod}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Original Amount</Typography>
                    <Typography fontWeight={800} color="primary.main">PKR {Number(refundDialog.payment.amount).toLocaleString()}</Typography>
                  </Grid>
                </Grid>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Refund Amount (PKR)"
                    type="number"
                    fullWidth
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    inputProps={{ min: 1, max: refundDialog.payment.amount }}
                    helperText={`Max: PKR ${Number(refundDialog.payment.amount).toLocaleString()}`}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Reason for Refund"
                    fullWidth
                    required
                    multiline
                    rows={2}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="e.g. Student withdrew, duplicate payment…"
                  />
                </Grid>
              </Grid>

              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                This will mark the payment as <strong>Refunded</strong> and post a reverse journal entry (Dr Fee Revenue / Cr Cash) to the General Ledger.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setRefundDialog({ open: false, payment: null })} color="inherit" disabled={refunding}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRefundPayment}
            disabled={refunding || !refundAmount || !refundReason.trim()}
            startIcon={refunding ? <CircularProgress size={16} color="inherit" /> : <UndoIcon />}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {refunding ? 'Processing…' : 'Confirm Refund'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeeRefunds;
