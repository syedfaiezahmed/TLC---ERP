import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  CircularProgress,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { TableRowSkeleton } from '../components/SkeletonLoaders';
import { clearAccountsError, createAccount, deleteAccount, getAccounts, updateAccount } from '../redux/accountSlice';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

const typeOptions = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];

const ChartOfAccounts = () => {
  const { companyId } = useParams();
  const dispatch = useDispatch();
  const theme = useTheme();

  const { accounts, loading, error } = useSelector((state) => state.accounts);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ code: '', name: '', type: 'expense' });

  useEffect(() => {
    if (companyId) dispatch(getAccounts(companyId));
  }, [dispatch, companyId]);

  useEffect(() => {
    if (error) toast.error(error);
    return () => {
      dispatch(clearAccountsError());
    };
  }, [dispatch, error]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => (a.code || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q));
  }, [accounts, search]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', type: 'expense' });
    setOpen(true);
  };

  const handleOpenEdit = (acc) => {
    setEditing(acc);
    setForm({ code: acc.code, name: acc.name, type: acc.type });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { companyId, code: form.code.trim(), name: form.name.trim(), type: form.type };
    if (!payload.code || !payload.name) return;

    const result = editing
      ? await dispatch(updateAccount({ id: editing._id, data: payload }))
      : await dispatch(createAccount(payload));

    if (!result.error) {
      toast.success(editing ? 'Account updated' : 'Account created');
      handleClose();
    }
  };

  const handleDelete = async (acc) => {
    if (acc.isSystem) return toast.error('System account delete nahi ho sakta');
    if (!window.confirm('Account delete kar dein?')) return;
    const result = await dispatch(deleteAccount(acc._id));
    if (!result.error) toast.success('Account deleted');
  };

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader
        title="Chart of Accounts"
        subtitle="COA codes, account types, aur control accounts manage karein."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ borderRadius: 2, px: 3, py: 1.2, fontWeight: 600 }}>
            Add Account
          </Button>
        }
      />

      <SectionCard>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <TextField
            size="small"
            placeholder="Search by code or name..."
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
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowSkeleton rows={6} cols={5} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No accounts found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((acc) => (
                  <TableRow key={acc._id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{acc.code}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{acc.name}</Typography>
                      {acc.isSystem && (
                        <Typography variant="caption" color="text.secondary">
                          System
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{acc.type}</TableCell>
                    <TableCell>{acc.isActive ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="primary" onClick={() => handleOpenEdit(acc)} disabled={acc.isSystem}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(acc)} disabled={acc.isSystem}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ p: 3 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Code" fullWidth required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <TextField label="Name" fullWidth required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <TextField select label="Type" fullWidth required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {typeOptions.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={handleClose} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ borderRadius: 2 }} disabled={!form.code.trim() || !form.name.trim()}>
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ChartOfAccounts;
