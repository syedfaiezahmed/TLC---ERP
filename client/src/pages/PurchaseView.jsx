import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import moment from 'moment';
import { toast } from 'react-toastify';
import { deletePurchase, fetchPurchase } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

const PurchaseView = () => {
  const { companyId, id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await fetchPurchase(id);
        setPurchase(data);
      } catch (e) {
        toast.error(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader
        title="Purchase Bill"
        subtitle="View bill details and payment history."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/company/${companyId}/purchases`)}
              sx={{ borderRadius: 2 }}
            >
              Back
            </Button>
            {purchase?._id ? (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/company/${companyId}/purchases/edit/${purchase._id}`)}
                sx={{ borderRadius: 2 }}
              >
                Edit
              </Button>
            ) : null}
            {purchase?._id ? (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={async () => {
                  if (!window.confirm('Are you sure you want to delete this purchase?')) return;
                  try {
                    await deletePurchase(purchase._id);
                    toast.success('Purchase deleted successfully');
                    navigate(`/company/${companyId}/purchases`);
                  } catch (e) {
                    toast.error(e.response?.data?.message || e.message);
                  }
                }}
                sx={{ borderRadius: 2 }}
              >
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !purchase ? (
        <Typography color="text.secondary">Purchase not found.</Typography>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <SectionCard sx={{ overflow: 'visible' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                  Bill #{purchase.purchaseNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date: {moment(purchase.date).format('DD MMM YYYY')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Due: {purchase.dueDate ? moment(purchase.dueDate).format('DD MMM YYYY') : '-'}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography fontWeight={700}>{purchase.supplier?.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {purchase.supplier?.contact || purchase.supplier?.email || '-'}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Total</Typography>
                  <Typography fontWeight={900}>PKR {Number(purchase.totalAmount || 0).toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Paid</Typography>
                  <Typography fontWeight={800} color="success.main">PKR {Number(purchase.paidAmount || 0).toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Discount</Typography>
                  <Typography fontWeight={800}>PKR {(purchase.payments || []).reduce((s, p) => s + Number(p.discount || 0), 0).toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Balance</Typography>
                  <Typography fontWeight={900} color={purchase.balanceDue > 0 ? 'error.main' : 'success.main'}>
                    PKR {Number(purchase.balanceDue || 0).toLocaleString()}
                  </Typography>
                </Box>
              </CardContent>
            </SectionCard>
          </Grid>

          <Grid item xs={12} md={8}>
            <SectionCard>
              <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="h6" fontWeight={800}>
                  Bill Lines
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(purchase.items || []).map((it, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{it.product?.name || '-'}</TableCell>
                        <TableCell>{it.description}</TableCell>
                        <TableCell align="right">{it.quantity}</TableCell>
                        <TableCell align="right">PKR {Number(it.price || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          PKR {Number(it.amount || (it.quantity * it.price) || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(purchase.items || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No items.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>

            <SectionCard sx={{ mt: 3 }}>
              <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="h6" fontWeight={800}>
                  Payment History
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Paid</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Discount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Settlement</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(purchase.payments || []).map((p, idx) => (
                      <TableRow key={p._id || idx} hover>
                        <TableCell>{moment(p.date).format('DD MMM YYYY')}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell>{p.reference || '-'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>
                          PKR {Number(p.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right">PKR {Number(p.discount || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900 }}>
                          PKR {Number((p.amount || 0) + (p.discount || 0)).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(purchase.payments || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No payments recorded.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default PurchaseView;
