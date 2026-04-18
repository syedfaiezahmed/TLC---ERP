import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getAssets, deleteAsset, postDepreciation, getDepreciationHistory,
} from '../redux/assetSlice';
import {
  Box, Typography, Button, Card, CardContent, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, TableContainer, IconButton, Chip,
  CircularProgress, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Alert, Stack, Tooltip, LinearProgress, alpha, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon,
  TrendingDown as TrendingDownIcon, Inventory as InventoryIcon,
  CalendarMonth as CalendarMonthIcon, AccountBalance as AccountBalanceIcon,
  History as HistoryIcon, OpenInNew as OpenInNewIcon, Warning as WarningIcon,
} from '@mui/icons-material';
import moment from 'moment';
import { toast } from 'react-toastify';
import StatCard from '../components/StatCard';

const BookValueBar = ({ cost, accumulated }) => {
  const pct = cost > 0 ? Math.max(0, Math.min(100, ((cost - accumulated) / cost) * 100)) : 100;
  return (
    <Box sx={{ mt: 0.5 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{ height: 6, borderRadius: 3, bgcolor: 'error.light', '& .MuiLinearProgress-bar': { bgcolor: pct > 40 ? 'success.main' : pct > 20 ? 'warning.main' : 'error.main' } }}
      />
      <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}% book value remaining</Typography>
    </Box>
  );
};

const DepreciationHistoryDialog = ({ open, onClose, asset, history }) => {
  if (!asset) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Depreciation History — {asset.name}
        <Typography variant="body2" color="text.secondary">Asset #{asset.assetNumber} · Cost: PKR {Number(asset.cost || 0).toLocaleString()}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {(!history || history.length === 0) ? (
          <Alert severity="info">No depreciation posted yet for this asset.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Dep. Amount</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Acc. Dep. Before</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Acc. Dep. After</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Book Value</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Posted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r._id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{r.month}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>
                      PKR {Number(r.amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">{Number(r.accumulatedDepreciationBefore || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">{Number(r.accumulatedDepreciationAfter || 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      PKR {Number(r.bookValueAfter || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {moment(r.createdAt).format('DD MMM YYYY')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const Assets = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId } = useParams();
  const theme = useTheme();

  const { assets, loading, depreciationLoading, depreciationHistory } = useSelector((s) => s.assets);

  const [depMonth, setDepMonth] = useState(moment().subtract(1, 'month').format('YYYY-MM'));
  const [historyDialog, setHistoryDialog] = useState({ open: false, asset: null });
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (companyId) dispatch(getAssets(companyId));
  }, [dispatch, companyId]);

  const stats = useMemo(() => {
    const totalCost = assets.reduce((s, a) => s + Number(a.cost || 0), 0);
    const totalAccDep = assets.reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0);
    const totalBookValue = totalCost - totalAccDep;
    const active = assets.filter((a) => a.status === 'active').length;
    return { totalCost, totalAccDep, totalBookValue, active };
  }, [assets]);

  const handlePostDepreciation = async () => {
    if (!depMonth) return toast.error('Select a month');
    try {
      const result = await dispatch(postDepreciation({ companyId, month: depMonth })).unwrap();
      toast.success(`Depreciation posted: ${result.postedCount} assets · PKR ${Number(result.totalPosted).toLocaleString()}`);
      dispatch(getAssets(companyId));
    } catch (err) {
      toast.error(err?.message || 'Depreciation posting failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteAsset(id)).unwrap();
      toast.success('Asset deleted');
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    }
    setConfirmDelete(null);
  };

  const handleViewHistory = async (asset) => {
    setHistoryDialog({ open: true, asset });
    if (!depreciationHistory[asset._id]) {
      dispatch(getDepreciationHistory(asset._id));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Asset Management</Typography>
          <Typography variant="body2" color="text.secondary">Track fixed assets, book values, and depreciation schedules</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => dispatch(getAssets(companyId))}>
            Refresh
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => navigate(`/company/${companyId}/purchases/create`)}>
            Add Asset (via Purchase)
          </Button>
        </Stack>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total Assets" value={stats.active} icon={<InventoryIcon />} color="primary" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total Cost" value={`PKR ${Math.round(stats.totalCost / 1000)}K`} icon={<AccountBalanceIcon />} color="info" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Acc. Depreciation" value={`PKR ${Math.round(stats.totalAccDep / 1000)}K`} icon={<TrendingDownIcon />} color="warning" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Net Book Value" value={`PKR ${Math.round(stats.totalBookValue / 1000)}K`} icon={<AccountBalanceIcon />} color="success" />
        </Grid>
      </Grid>

      {/* Depreciation Posting Panel */}
      <Card sx={{ borderRadius: 3, mb: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            📅 Post Monthly Depreciation (Straight-Line Method)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Posts journal entries: Dr Depreciation Expense · Cr Accumulated Depreciation — for all active assets
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              label="Month" type="month" size="small"
              value={depMonth}
              onChange={(e) => setDepMonth(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />
            <Button
              variant="contained" color="secondary"
              startIcon={depreciationLoading ? <CircularProgress size={16} color="inherit" /> : <TrendingDownIcon />}
              disabled={depreciationLoading}
              onClick={handlePostDepreciation}
              sx={{ fontWeight: 700 }}
            >
              {depreciationLoading ? 'Posting...' : 'Post Depreciation'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Assets Table */}
      {assets.length === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
          <InventoryIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No Assets Found</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            Create a purchase with "Asset Purchase" category to automatically add assets here
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => navigate(`/company/${companyId}/purchases/create`)}>
            Record Asset Purchase
          </Button>
        </Card>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Asset Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Cost (PKR)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Acc. Dep.</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Book Value</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Dep. Through</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Book Value %</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.map((asset) => {
                  const bookValue = Math.max(0, Number(asset.cost || 0) - Number(asset.accumulatedDepreciation || 0));
                  const depreciableBase = Math.max(0, Number(asset.cost || 0) - Number(asset.salvageValue || 0));
                  const life = Math.max(1, Number(asset.usefulLifeMonths || 1));
                  const monthly = Number((depreciableBase / life).toFixed(2));
                  const fullyDepreciated = bookValue <= Number(asset.salvageValue || 0);

                  return (
                    <TableRow key={asset._id} hover>
                      <TableCell sx={{ color: 'text.secondary' }}>{asset.assetNumber}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography fontWeight={700} variant="body2">{asset.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {asset.assetAccountName} · {Number(asset.usefulLifeMonths || 0)} mo life
                          </Typography>
                          {moment(asset.acquisitionDate).format('DD MMM YYYY') && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Acquired: {moment(asset.acquisitionDate).format('DD MMM YYYY')}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={asset.category || 'Fixed Asset'} size="small"
                          sx={{ borderRadius: 1, fontWeight: 600, fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {Number(asset.cost || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>
                        {Number(asset.accumulatedDepreciation || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color={fullyDepreciated ? 'error.main' : 'success.main'}>
                          {bookValue.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Monthly: {monthly.toLocaleString()}/mo
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {asset.depreciationPostedThrough ? (
                          <Chip size="small" label={asset.depreciationPostedThrough}
                            color="primary" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                        ) : (
                          <Chip size="small" label="Not Posted" color="default" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <BookValueBar cost={Number(asset.cost || 0)} accumulated={Number(asset.accumulatedDepreciation || 0)} />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Depreciation History">
                          <IconButton size="small" color="primary" onClick={() => handleViewHistory(asset)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Asset">
                          <span>
                            <IconButton size="small" color="error"
                              onClick={() => setConfirmDelete(asset)}
                              disabled={Number(asset.accumulatedDepreciation || 0) > 0}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Depreciation History Dialog */}
      <DepreciationHistoryDialog
        open={historyDialog.open}
        onClose={() => setHistoryDialog({ open: false, asset: null })}
        asset={historyDialog.asset}
        history={historyDialog.asset ? depreciationHistory[historyDialog.asset._id] : []}
      />

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>
          <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Delete Asset
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
            This will also reverse all journal entries for this asset.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => handleDelete(confirmDelete?._id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Assets;
