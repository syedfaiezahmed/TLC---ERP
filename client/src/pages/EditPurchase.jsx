import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import moment from 'moment';
import {
  Typography,
  Button,
  TextField,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  Autocomplete,
  Divider,
  Card,
  CardContent,
  useTheme,
  TableContainer,
  alpha,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Save as SaveIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { getTeachers } from '../redux/teacherSlice';
import { getCourses } from '../redux/courseSlice';
import { updatePurchase } from '../redux/purchaseSlice';
import { fetchPurchase } from '../services/api';

const EditPurchase = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId, id } = useParams();
  const theme = useTheme();

  const { teachers = [] } = useSelector((state) => state.teachers);
  const { courses = [] } = useSelector((state) => state.courses);

  const [loading, setLoading] = useState(true);
  const [purchaseData, setPurchaseData] = useState({
    teacherId: '',
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await fetchPurchase(id);
        setPurchaseData({
          teacherId: data.teacher?._id || '',
          date: data.date ? moment(data.date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'),
          dueDate: data.dueDate ? moment(data.dueDate).format('YYYY-MM-DD') : '',
          items: (data.items || []).map((it) => ({
            course: it.course || null,
            description: it.description || '',
            quantity: Number(it.quantity || 0),
            price: Number(it.price || 0),
            discount: Number(it.discount || 0),
            amount: Number(it.amount ?? (Number(it.quantity || 0) * Number(it.price || 0) - Number(it.discount || 0))),
          })),
          taxRate: Number(data.taxRate || 0),
          cashDiscount: Number(data.cashDiscount || 0),
          notes: data.notes || '',
        });
      } catch (e) {
        toast.error(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const selectedTeacher = useMemo(() => teachers?.find((t) => t._id === purchaseData.teacherId) || null, [purchaseData.teacherId, teachers]);

  const handleCourseSelect = (index, course) => {
    const values = [...purchaseData.items];
    values[index].course = course;
    if (course) {
      values[index].description = values[index].description || course.name || '';
      if (!values[index].price || Number(values[index].price) === 0) {
        values[index].price = Number(course.fee || 0);
      }
    }
    const qty = Number(values[index].quantity || 0);
    const price = Number(values[index].price || 0);
    const discount = Number(values[index].discount || 0);
    values[index].amount = qty * price - discount;
    setPurchaseData({ ...purchaseData, items: values });
  };

  const handleItemChange = (index, e) => {
    const values = [...purchaseData.items];
    values[index][e.target.name] = e.target.value;
    if (['quantity', 'price', 'discount'].includes(e.target.name)) {
      const qty = Number(values[index].quantity || 0);
      const price = Number(values[index].price || 0);
      const discount = Number(values[index].discount || 0);
      values[index].amount = qty * price - discount;
    }
    setPurchaseData({ ...purchaseData, items: values });
  };

  const addItem = () => {
    setPurchaseData({
      ...purchaseData,
      items: [...purchaseData.items, { description: '', quantity: 1, price: 0, discount: 0, amount: 0, course: null }],
    });
  };

  const removeItem = (index) => {
    const values = [...purchaseData.items];
    values.splice(index, 1);
    setPurchaseData({ ...purchaseData, items: values });
  };

  const subtotal = purchaseData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxable = Math.max(0, subtotal - Number(purchaseData.cashDiscount || 0));
  const taxAmount = (taxable * Number(purchaseData.taxRate || 0)) / 100;
  const total = taxable + taxAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!purchaseData.teacherId) return toast.error('Please select a teacher');
    if (purchaseData.items.some((item) => !item.course)) return toast.error('Please select course for all items');
    if (purchaseData.items.some((item) => !item.description || item.amount <= 0)) return toast.error('Check all items');

    try {
      const payload = {
        teacherId: purchaseData.teacherId,
        date: purchaseData.date,
        dueDate: purchaseData.dueDate,
        items: purchaseData.items.map((i) => ({
          course: i.course?._id || null,
          description: i.description,
          quantity: Number(i.quantity || 0),
          price: Number(i.price || 0),
          discount: Number(i.discount || 0),
          amount: Number(i.amount || 0),
        })),
        taxRate: Number(purchaseData.taxRate || 0),
        cashDiscount: Number(purchaseData.cashDiscount || 0),
        notes: purchaseData.notes,
      };
      await dispatch(updatePurchase({ id, payload })).unwrap();
      toast.success('Purchase updated successfully');
      navigate(`/company/${companyId}/purchases`);
    } catch (error) {
      toast.error(error?.message || error?.data?.message || 'Failed to update purchase');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate(`/company/${companyId}/purchases`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={800}>
          Edit Purchase Bill
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[2] }}>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      options={teachers || []}
                      getOptionLabel={(option) => option.name || ''}
                      value={selectedTeacher}
                      onChange={(e, val) => setPurchaseData({ ...purchaseData, teacherId: val ? val._id : '' })}
                      renderInput={(params) => <TextField {...params} label="Select Teacher *" required />}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Date *"
                      type="date"
                      fullWidth
                      required
                      value={purchaseData.date}
                      onChange={(e) => setPurchaseData({ ...purchaseData, date: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>

                <TableContainer>
                  <Table>
                    <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Description / Item</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} width={120}>Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} width={150}>Price</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} width={150}>Discount</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }} width={150}>Amount</TableCell>
                        <TableCell align="center" width={60}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {purchaseData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" flexDirection="column" gap={1}>
                              <Autocomplete
                                options={courses || []}
                                getOptionLabel={(option) => option.name || ''}
                                isOptionEqualToValue={(o, v) => o._id === v._id}
                                value={item.course}
                                onChange={(e, val) => handleCourseSelect(index, val)}
                                renderInput={(params) => <TextField {...params} label="Select Course *" size="small" required />}
                                fullWidth
                              />
                              <TextField
                                fullWidth
                                size="small"
                                name="description"
                                value={item.description}
                                onChange={(e) => handleItemChange(index, e)}
                                placeholder="Item description"
                                required
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <TextField fullWidth size="small" type="number" name="quantity" value={item.quantity} onChange={(e) => handleItemChange(index, e)} required />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              name="price"
                              value={item.price}
                              onChange={(e) => handleItemChange(index, e)}
                              required
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start" sx={{ mr: 0.5 }}>
                                    <Typography variant="caption">PKR</Typography>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              name="discount"
                              value={item.discount}
                              onChange={(e) => handleItemChange(index, e)}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start" sx={{ mr: 0.5 }}>
                                    <Typography variant="caption">PKR</Typography>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            PKR {Number(item.amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton color="error" size="small" onClick={() => removeItem(index)} disabled={purchaseData.items.length === 1}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Button startIcon={<AddIcon />} onClick={addItem} sx={{ mt: 2 }}>
                  Add Another Item
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 4, boxShadow: theme.shadows[2], position: 'sticky', top: 24 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={800} gutterBottom>
                  Summary
                </Typography>
                <Divider sx={{ my: 2 }} />

                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="text.secondary">Subtotal</Typography>
                  <Typography fontWeight={800}>PKR {subtotal.toLocaleString()}</Typography>
                </Box>

                <TextField
                  label="Tax Rate (%)"
                  type="number"
                  fullWidth
                  value={purchaseData.taxRate}
                  onChange={(e) => setPurchaseData({ ...purchaseData, taxRate: e.target.value })}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Cash Discount (PKR)"
                  type="number"
                  fullWidth
                  value={purchaseData.cashDiscount}
                  onChange={(e) => setPurchaseData({ ...purchaseData, cashDiscount: e.target.value })}
                  sx={{ mb: 2 }}
                />

                <Divider sx={{ my: 2 }} />

                <Box display="flex" justifyContent="space-between" mb={3}>
                  <Typography fontWeight={800}>Total Amount</Typography>
                  <Typography fontWeight={900} color="primary.main">
                    PKR {total.toLocaleString()}
                  </Typography>
                </Box>

                <Button type="submit" variant="contained" fullWidth startIcon={<SaveIcon />} sx={{ borderRadius: 2, py: 1.4 }}>
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default EditPurchase;

