import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createFee, getFee, updateFee, clearCurrentFee } from '../redux/feeSlice';
import { getStudents } from '../redux/studentSlice';
import { getCourses } from '../redux/courseSlice';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Grid,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  Autocomplete,
  CircularProgress,
  Stack,
  Divider,
  Card,
  CardContent,
  InputAdornment,
  useTheme,
  alpha,
  TableContainer,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import moment from 'moment';

const CreateFee = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId, id } = useParams(); 
  
  const { selectedCompany } = useSelector((state) => state.companies);
  const { students } = useSelector((state) => state.students);
  const { courses } = useSelector((state) => state.courses);
  const { currentFee } = useSelector((state) => state.fees);
  const theme = useTheme();
  const [loading, setLoading] = useState(false);

  const [feeData, setFeeData] = useState({
    studentId: '',
    date: moment().format('YYYY-MM-DD'),
    dueDate: '',
    items: [{ description: '', quantity: 1, price: 0, discount: 0, amount: 0, course: null }],
    taxRate: 0,
    cashDiscount: 0,
    status: 'unpaid',
    notes: ''
  });

  useEffect(() => {
    const cid = companyId || selectedCompany?._id;
    if (cid) {
        dispatch(getStudents({ companyId: cid, page: 1, limit: 1000, search: '' }));
        dispatch(getCourses(cid));
    }
  }, [dispatch, selectedCompany, companyId]);

  useEffect(() => {
      if (id) {
          dispatch(getFee(id));
      } else {
          dispatch(clearCurrentFee());
      }
  }, [dispatch, id]);

  useEffect(() => {
      if (currentFee && id) {
          setFeeData({
              studentId: currentFee.student?._id || currentFee.student,
              date: moment(currentFee.date).format('YYYY-MM-DD'),
              dueDate: currentFee.dueDate ? moment(currentFee.dueDate).format('YYYY-MM-DD') : '',
              items: currentFee.items.map(item => ({ ...item, course: null })), 
              taxRate: currentFee.taxRate,
              cashDiscount: currentFee.cashDiscount || 0,
              status: currentFee.status,
              notes: currentFee.notes
          });
      }
  }, [currentFee, id]);


  const handleItemChange = (index, e) => {
      const values = [...feeData.items];
      values[index][e.target.name] = e.target.value;
      
      if (e.target.name === 'quantity' || e.target.name === 'price' || e.target.name === 'discount') {
          const qty = Number(values[index].quantity);
          const price = Number(values[index].price);
          const discount = Number(values[index].discount || 0);
          values[index].amount = (qty * price) - discount;
      }
      
      setFeeData({ ...feeData, items: values });
  };
  
  const handleCourseSelect = (index, newValue) => {
      const values = [...feeData.items];
      if (newValue) {
          values[index].course = newValue;
          values[index].description = newValue.name; 
          values[index].price = newValue.fee || newValue.price;
          values[index].discount = 0;
          values[index].amount = values[index].quantity * (newValue.fee || newValue.price);
      } else {
          values[index].course = null;
      }
      setFeeData({ ...feeData, items: values });
  };

  const addItem = () => {
      setFeeData({ 
          ...feeData, 
          items: [...feeData.items, { description: '', quantity: 1, price: 0, discount: 0, amount: 0, course: null }] 
      });
  };

  const removeItem = (index) => {
      const values = [...feeData.items];
      values.splice(index, 1);
      setFeeData({ ...feeData, items: values });
  };

  const calculateSubTotal = () => {
      return feeData.items.reduce((acc, item) => acc + ((item.quantity * item.price) - (item.discount || 0)), 0);
  };

  const calculateTotal = () => {
      const subTotal = calculateSubTotal();
      const discount = Number(feeData.cashDiscount || 0);
      const taxable = Math.max(0, subTotal - discount);
      const tax = (taxable * feeData.taxRate) / 100;
      return taxable + tax;
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      const cid = companyId || selectedCompany?._id;
      if (!cid) return;

      setLoading(true);
      
      const processedItems = feeData.items.map(item => ({
          ...item,
          course: item.course ? item.course._id : null
      }));

      const payload = {
          ...feeData,
          items: processedItems,
          companyId: cid
      };

      try {
        if (id) {
            await dispatch(updateFee({ id, fee: payload })).unwrap();
            alert('Fee record updated successfully!');
        } else {
            await dispatch(createFee(payload)).unwrap();
            alert('Fee receipt created successfully!');
        }
        navigate(`/company/${cid}/fees`);
      } catch (error) {
          console.error('Failed to save fee:', error);
          alert(`Failed to save fee: ${error?.message || 'Unknown error'}`);
      } finally {
          setLoading(false);
      }
  };

  if (!selectedCompany && !companyId) return <Typography>Please select an institute first</Typography>;

  return (
    <Container maxWidth={false} sx={{ mt: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <IconButton 
            onClick={() => navigate(-1)} 
            sx={{ 
                bgcolor: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                '&:hover': { bgcolor: 'grey.50' },
                padding: '8px'
            }}
          >
              <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" fontWeight={700} sx={{ 
              color: 'text.primary',
              letterSpacing: -0.5
          }}>
            {id ? 'Edit Fee Receipt' : 'Create New Fee Receipt'}
          </Typography>
      </Stack>

      <Paper sx={{ 
          p: 2, 
          borderRadius: 3, 
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
      }}>
        <form onSubmit={handleSubmit}>
            <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        select
                        label="Student"
                        fullWidth
                        size="small"
                        value={feeData.studentId}
                        onChange={(e) => setFeeData({ ...feeData, studentId: e.target.value })}
                        required
                        variant="outlined"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    >
                        {students.map((option) => (
                            <MenuItem key={option._id} value={option._id}>
                                {option.name}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                    <TextField
                        label="Date"
                        type="date"
                        fullWidth
                        size="small"
                        value={feeData.date}
                        onChange={(e) => setFeeData({ ...feeData, date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        required
                        variant="outlined"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                </Grid>
                <Grid item xs={12} sm={3}>
                     <TextField
                        label="Due Date"
                        type="date"
                        fullWidth
                        size="small"
                        value={feeData.dueDate}
                        onChange={(e) => setFeeData({ ...feeData, dueDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                </Grid>
                
                <Grid item xs={12}>
                            <Divider sx={{ my: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                                    FEE ITEMS
                                </Typography>
                            </Divider>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table size="small" sx={{ 
                                    minWidth: 600,
                                    '& .MuiTableCell-root': { borderBottom: '1px solid', borderColor: 'divider' },
                                    '& .MuiTableCell-head': { bgcolor: alpha(theme.palette.primary.main, 0.05), color: 'primary.main', fontWeight: 700 }
                                }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell width="30%">Course / Description</TableCell>
                                            <TableCell width="15%">Qty</TableCell>
                                            <TableCell width="20%">Fee (PKR)</TableCell>
                                            <TableCell width="15%">Discount</TableCell>
                                            <TableCell width="15%">Amount</TableCell>
                                            <TableCell width="5%"></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {feeData.items.map((item, index) => (
                                            <TableRow key={index} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                                                <TableCell sx={{ verticalAlign: 'top', pt: 1.5, pb: 1 }}>
                                                    <Box display="flex" flexDirection="column" gap={1}>
                                                        <Autocomplete
                                                            options={courses || []}
                                                            getOptionLabel={(option) => option.name || ""}
                                                            value={item.course}
                                                            onChange={(e, newValue) => handleCourseSelect(index, newValue)}
                                                            renderInput={(params) => <TextField {...params} label="Select Course" size="small" variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }} />}
                                                            fullWidth
                                                        />
                                                        <TextField 
                                                            name="description" 
                                                            value={item.description} 
                                                            onChange={(e) => handleItemChange(index, e)} 
                                                            fullWidth size="small" required
                                                            placeholder="Description"
                                                            variant="outlined"
                                                            multiline
                                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                                                        />
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                                                    <TextField 
                                                        name="quantity"
                                                        label="Quantity" 
                                                        type="number" 
                                                        value={item.quantity} 
                                                        onChange={(e) => handleItemChange(index, e)} 
                                                        fullWidth size="small" required inputProps={{ min: 1 }}
                                                        variant="outlined"
                                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                                                    <TextField 
                                                        name="price"
                                                        label="Fee (PKR)" 
                                                        type="number" 
                                                        value={item.price} 
                                                        onChange={(e) => handleItemChange(index, e)} 
                                                        fullWidth size="small" required inputProps={{ min: 0 }}
                                                        variant="outlined"
                                                        InputProps={{
                                                            startAdornment: <InputAdornment position="start" sx={{ mr: 0.5 }}><Typography variant="caption">PKR</Typography></InputAdornment>,
                                                        }}
                                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                                                    <TextField 
                                                        name="discount"
                                                        label="Discount (PKR)" 
                                                        type="number" 
                                                        value={item.discount} 
                                                        onChange={(e) => handleItemChange(index, e)} 
                                                        fullWidth size="small" inputProps={{ min: 0 }}
                                                        variant="outlined"
                                                        placeholder="0"
                                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', pt: 2 }}>
                                                    <Typography fontWeight={700} color="text.primary">
                                                        PKR {((item.quantity * item.price) - (item.discount || 0)).toFixed(2)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                                                    <IconButton size="small" onClick={() => removeItem(index)} color="error" sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                    <Button 
                        startIcon={<AddIcon />} 
                        onClick={addItem} 
                        sx={{ mt: 2, textTransform: 'none', borderRadius: 2 }}
                        variant="outlined"
                        size="small"
                    >
                        Add Line Item
                    </Button>
                </Grid>

                <Grid item xs={12} md={5} sx={{ ml: 'auto' }}>
                    <Card variant="outlined" sx={{ bgcolor: 'grey.50', borderRadius: 3, border: 'none' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography color="text.secondary">Subtotal:</Typography>
                                <Typography fontWeight={600}>PKR {calculateSubTotal().toFixed(2)}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Typography color="text.secondary">Scholarship/Discount:</Typography>
                                <TextField 
                                    type="number" 
                                    size="small" 
                                    value={feeData.cashDiscount} 
                                    onChange={(e) => setFeeData({ ...feeData, cashDiscount: e.target.value })}
                                    sx={{ width: 100, bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    variant="outlined"
                                    placeholder="0"
                                />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                <Typography color="text.secondary">Tax Rate (%):</Typography>
                                <TextField 
                                    type="number" 
                                    size="small" 
                                    value={feeData.taxRate} 
                                    onChange={(e) => setFeeData({ ...feeData, taxRate: e.target.value })}
                                    sx={{ width: 100, bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    variant="outlined"
                                />
                            </Box>
                            <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                                <Typography variant="h6" fontWeight={800}>Total:</Typography>
                                <Typography variant="h6" fontWeight={800} sx={{ color: 'primary.main' }}>
                                    PKR {calculateTotal().toFixed(2)}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                
                <Grid item xs={12} container spacing={3} alignItems="center">
                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            label="Payment Status"
                            value={feeData.status}
                            onChange={(e) => setFeeData({ ...feeData, status: e.target.value })}
                            fullWidth
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        >
                            <MenuItem value="unpaid">Unpaid</MenuItem>
                            <MenuItem value="paid">Paid</MenuItem>
                            <MenuItem value="partial">Partial</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                         <TextField
                            label="Notes / Terms"
                            multiline
                            rows={2}
                            fullWidth
                            value={feeData.notes}
                            onChange={(e) => setFeeData({ ...feeData, notes: e.target.value })}
                            variant="outlined"
                            placeholder="Thank you for choosing our institute!"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                    </Grid>
                </Grid>

                <Grid item xs={12} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'flex-end', gap: 2, mt: 4 }}>
                    <Button 
                        variant="outlined" 
                        size="large" 
                        onClick={() => navigate(-1)}
                        disabled={loading}
                        sx={{ borderRadius: 3, px: 4, textTransform: 'none', fontWeight: 600, width: { xs: '100%', sm: 'auto' } }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        variant="contained" 
                        size="large" 
                        startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <SaveIcon />}
                        disabled={loading}
                        sx={{ 
                            px: 5, 
                            borderRadius: 3, 
                            textTransform: 'none', 
                            fontWeight: 600,
                            bgcolor: 'primary.main',
                            boxShadow: 'none',
                            width: { xs: '100%', sm: 'auto' },
                            '&:hover': {
                                bgcolor: 'primary.dark',
                                boxShadow: 'none',
                            }
                        }}
                    >
                        {loading ? 'Saving...' : (id ? 'Update Fee Record' : 'Create Fee Receipt')}
                    </Button>
                </Grid>
            </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default CreateFee;
