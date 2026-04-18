import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { getFee, recordPayment } from '../redux/feeSlice';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  InputAdornment,
  useTheme,
  alpha,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { PageTableSkeleton } from '../components/SkeletonLoaders';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentIcon from '@mui/icons-material/Payment';
import PrintIcon from '@mui/icons-material/Print';
import moment from 'moment';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const FeePreview = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentFee, loading, error } = useSelector((state) => state.fees);
  const { selectedCompany } = useSelector((state) => state.companies);
  const feeRef = useRef(null);
  
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [paymentData, setPaymentData] = useState({
      amount: '',
      discount: '',
      date: moment().format('YYYY-MM-DD'),
      method: 'Cash',
      reference: '',
      notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(getFee(id));
    }
  }, [dispatch, id]);

  const handleDownloadPDF = async () => {
    const element = feeRef.current;
    if (!element) return;

    try {
        const canvas = await html2canvas(element, {
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210; 
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`Fee_Receipt_${currentFee.feeNumber}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Failed to generate PDF");
    }
  };

  const handlePaymentSubmit = async () => {
      if (!paymentData.amount || paymentData.amount <= 0) {
          alert("Please enter a valid amount");
          return;
      }
      
      setIsSubmitting(true);
      try {
          const result = await dispatch(recordPayment({ 
              id: currentFee._id, 
              paymentData: { 
                ...paymentData, 
                amount: Number(paymentData.amount),
                discount: Number(paymentData.discount || 0)
              } 
          }));

          if (!result.error) {
              setOpenPaymentDialog(false);
              setPaymentData({
                  amount: '',
                  discount: '',
                  date: moment().format('YYYY-MM-DD'),
                  method: 'Cash',
                  reference: '',
                  notes: ''
              });
              dispatch(getFee(id));
          } else {
              alert(result.payload?.message || "Payment failed");
          }
      } catch (error) {
          console.error("Payment error:", error);
          alert("An unexpected error occurred.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 2
    }).format(amount || 0);
  };

  if (loading) return <PageTableSkeleton cols={5} rows={10} />;
  if (error) return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!currentFee) return <Box p={3}><Alert severity="info">Fee receipt not found</Alert></Box>;

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      {/* Action Buttons */}
      <Paper elevation={0} sx={{ p: 2, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'transparent' }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ 
            color: 'text.secondary',
            bgcolor: 'white',
            px: 3,
            py: 1,
            borderRadius: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            '&:hover': { bgcolor: 'grey.50' }
          }}
        >
          Back
        </Button>
        <Box display="flex" gap={2}>
            {currentFee.status !== 'paid' && (
                <Button 
                    startIcon={<PaymentIcon />} 
                    variant="contained" 
                    color="success"
                    onClick={() => setOpenPaymentDialog(true)}
                    sx={{ 
                        borderRadius: 3,
                        bgcolor: 'success.main',
                        boxShadow: 'none',
                        '&:hover': {
                            bgcolor: 'success.dark',
                            boxShadow: 'none'
                        }
                    }}
                >
                    Record Payment
                </Button>
            )}
            <Button 
            startIcon={<DownloadIcon />} 
            variant="contained" 
            onClick={handleDownloadPDF}
            sx={{ 
                borderRadius: 3,
                bgcolor: 'primary.main',
                boxShadow: 'none',
                '&:hover': {
                    bgcolor: 'primary.dark',
                    boxShadow: 'none'
                }
            }}
            >
            Download PDF
            </Button>
        </Box>
      </Paper>

      {/* Fee Paper */}
      <Paper 
        ref={feeRef}
        elevation={0} 
        sx={{ 
          p: 6, 
          bgcolor: 'white',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 1,
          minHeight: '29.7cm', 
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)'
        }}
      >
        {/* Status Ribbon if Paid */}
        {currentFee.status === 'paid' && (
            <Box sx={{ 
                position: 'absolute', 
                top: 35, 
                right: -35, 
                bgcolor: 'success.main', 
                color: 'white', 
                width: 150,
                textAlign: 'center',
                py: 1, 
                transform: 'rotate(45deg)',
                boxShadow: 2,
                zIndex: 10
            }}>
                <Typography variant="subtitle1" fontWeight="bold" letterSpacing={1}>PAID</Typography>
            </Box>
        )}

        {/* Header */}
        <Box display="flex" justifyContent="space-between" mb={6}>
          <Box>
            {selectedCompany?.logo ? (
                 <img src={selectedCompany.logo} alt="Logo" style={{ maxWidth: 150, maxHeight: 80, marginBottom: 16, objectFit: 'contain' }} />
            ) : (
                <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
                  FEE RECEIPT
                </Typography>
            )}
            
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {selectedCompany?.name}
            </Typography>
            <Box color="text.secondary" sx={{ typography: 'body2', lineHeight: 1.6 }}>
                <Box>{selectedCompany?.address || 'Institute Address'}</Box>
                <Box>{selectedCompany?.email}</Box>
                <Box>{selectedCompany?.contact}</Box>
                {selectedCompany?.website && <Box>{selectedCompany.website}</Box>}
                {selectedCompany?.taxId && <Box>Tax ID: {selectedCompany.taxId}</Box>}
            </Box>
          </Box>
          <Box textAlign="right" sx={{ pt: 2 }}>
             <Typography variant="h3" color="grey.200" fontWeight="900" sx={{ letterSpacing: 2, mb: 1 }}>
                RECEIPT
             </Typography>
             <Typography variant="h6" color="text.primary">#{currentFee.feeNumber}</Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 6 }} />

        {/* Info Grid */}
        <Grid container spacing={4} mb={6}>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Student Details
            </Typography>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {currentFee.student?.name}
            </Typography>
            <Box color="text.secondary" sx={{ typography: 'body2', lineHeight: 1.6 }}>
                <Box>{currentFee.student?.email}</Box>
                <Box>{currentFee.student?.contact}</Box>
                <Box>{currentFee.student?.address}</Box>
            </Box>
          </Grid>
          <Grid item xs={6} display="flex" flexDirection="column" alignItems="flex-end">
            <Box mb={2} textAlign="right">
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Receipt Date
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {moment(currentFee.date).format('MMMM DD, YYYY')}
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Due Date
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {moment(currentFee.dueDate).format('MMMM DD, YYYY')}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Items Table */}
        <TableContainer sx={{ mb: 4, borderRadius: 2, overflowX: 'auto' }}>
          <Table sx={{ minWidth: 500 }}>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', py: 2 }}>Course / Description</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', py: 2 }}>Quantity</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', py: 2 }}>Fee</TableCell>
                {currentFee.items?.some(i => i.discount > 0) && (
                    <TableCell align="right" sx={{ fontWeight: 'bold', py: 2 }}>Discount</TableCell>
                )}
                <TableCell align="right" sx={{ fontWeight: 'bold', py: 2 }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentFee.items?.map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell sx={{ py: 2 }}>{item.description}</TableCell>
                  <TableCell align="right" sx={{ py: 2 }}>{item.quantity}</TableCell>
                  <TableCell align="right" sx={{ py: 2 }}>{formatCurrency(item.price)}</TableCell>
                  {currentFee.items?.some(i => i.discount > 0) && (
                      <TableCell align="right" sx={{ py: 2, color: 'error.main' }}>
                          {item.discount > 0 ? `-${formatCurrency(item.discount)}` : '-'}
                      </TableCell>
                  )}
                  <TableCell align="right" sx={{ py: 2 }}>
                      {formatCurrency((item.quantity * item.price) - (item.discount || 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Totals */}
        <Box display="flex" justifyContent="flex-end">
          <Box sx={{ width: '300px' }}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography color="text.secondary">Subtotal:</Typography>
              <Typography fontWeight="medium">{formatCurrency(currentFee.subTotal)}</Typography>
            </Box>
            {currentFee.cashDiscount > 0 && (
                <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography color="text.secondary">Scholarship/Discount:</Typography>
                    <Typography fontWeight="medium" color="error.main">-{formatCurrency(currentFee.cashDiscount)}</Typography>
                </Box>
            )}
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography color="text.secondary">Tax ({currentFee.taxRate}%):</Typography>
              <Typography fontWeight="medium">{formatCurrency(currentFee.taxAmount)}</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" justifyContent="space-between" mb={1} alignItems="center">
              <Typography variant="h6" fontWeight="bold">Total:</Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">{formatCurrency(currentFee.totalAmount)}</Typography>
            </Box>
            {currentFee.paidAmount > 0 && (
                <Box display="flex" justifyContent="space-between" mb={1} mt={1}>
                    <Typography color="success.main">Paid:</Typography>
                    <Typography fontWeight="medium" color="success.main">{formatCurrency(currentFee.paidAmount)}</Typography>
                </Box>
            )}
             {currentFee.balanceDue > 0 && (
                <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography color="error.main" fontWeight="bold">Balance Due:</Typography>
                    <Typography fontWeight="bold" color="error.main">{formatCurrency(currentFee.balanceDue)}</Typography>
                </Box>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box mt="auto" pt={8} borderTop="1px solid" borderColor="divider" textAlign="center">
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Thank you for choosing our institute!
          </Typography>
          {currentFee.notes && (
             <Typography variant="body2" color="text.secondary" mt={1} fontStyle="italic">
                Note: {currentFee.notes}
             </Typography>
          )}
          {selectedCompany?.website && (
             <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                 {selectedCompany.website}
             </Typography>
          )}
        </Box>

      </Paper>

      {/* Payment History Dialog */}
      <Dialog 
        open={openHistoryDialog} 
        onClose={() => setOpenHistoryDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
          <DialogTitle sx={{ fontWeight: 'bold' }}>Payment History</DialogTitle>
          <DialogContent dividers>
             {currentFee.payments && currentFee.payments.length > 0 ? (
                 <List>
                     {currentFee.payments.map((payment, index) => (
                         <React.Fragment key={index}>
                             <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                                 <ListItemText
                                     primary={
                                         <Box display="flex" justifyContent="space-between" alignItems="center">
                                             <Typography variant="subtitle1" fontWeight="bold">
                                                 {formatCurrency(payment.amount)}
                                             </Typography>
                                             <Chip 
                                                 label={payment.method} 
                                                 size="small" 
                                                 sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main', fontWeight: 600 }} 
                                             />
                                         </Box>
                                     }
                                     secondary={
                                         <Box component="span" display="flex" flexDirection="column" mt={0.5}>
                                             <Typography variant="body2" color="text.secondary">
                                                 Date: {moment(payment.date).format('MMM DD, YYYY')}
                                             </Typography>
                                             {payment.reference && (
                                                 <Typography variant="body2" color="text.secondary">
                                                     Ref: {payment.reference}
                                                 </Typography>
                                             )}
                                         </Box>
                                     }
                                 />
                             </ListItem>
                             {index < currentFee.payments.length - 1 && <Divider component="li" />}
                         </React.Fragment>
                     ))}
                 </List>
             ) : (
                 <Box py={4} textAlign="center">
                     <Typography color="text.secondary">No payments recorded yet.</Typography>
                 </Box>
             )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={() => setOpenHistoryDialog(false)}>Close</Button>
          </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog 
        open={openPaymentDialog} 
        onClose={() => setOpenPaymentDialog(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
          <DialogTitle sx={{ fontWeight: 'bold' }}>Record Fee Payment</DialogTitle>
          <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1, minWidth: 400 }}>
                  <Alert severity="info" icon={<PaymentIcon />}>
                      Balance Due: <strong>{formatCurrency(currentFee.balanceDue)}</strong>
                  </Alert>
                  <TextField
                      label="Amount"
                      type="number"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      fullWidth
                      required
                      InputProps={{
                          startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                      }}
                      inputProps={{ max: currentFee.balanceDue }}
                  />
                  <TextField
                      label="Scholarship/Discount (Optional)"
                      type="number"
                      value={paymentData.discount}
                      onChange={(e) => setPaymentData({ ...paymentData, discount: e.target.value })}
                      fullWidth
                      InputProps={{
                          startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                      }}
                  />
                  <TextField
                      label="Date"
                      type="date"
                      value={paymentData.date}
                      onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                      select
                      label="Payment Method"
                      value={paymentData.method}
                      onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                      fullWidth
                  >
                      {['Cash', 'Bank Transfer', 'Cheque', 'Other'].map((option) => (
                          <MenuItem key={option} value={option}>
                              {option}
                          </MenuItem>
                      ))}
                  </TextField>
                  <TextField
                      label="Reference (Optional)"
                      value={paymentData.reference}
                      onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                      fullWidth
                      placeholder="e.g. Transaction ID"
                  />
                  <TextField
                      label="Notes (Optional)"
                      value={paymentData.notes}
                      onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                      fullWidth
                      multiline
                      rows={2}
                  />
              </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setOpenPaymentDialog(false)} sx={{ color: 'text.secondary' }} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handlePaymentSubmit} variant="contained" color="success" sx={{ px: 3, borderRadius: 2 }} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Submit Payment'}
            </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FeePreview;
