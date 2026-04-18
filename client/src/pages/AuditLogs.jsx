import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  useTheme,
  alpha,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import moment from 'moment';
import { fetchAuditLogs } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

const AuditLogs = () => {
  const { companyId } = useParams();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAuditLogs(companyId, { page: 1, limit: 200 });
      setLogs(data.logs || []);
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) load();
  }, [companyId, load]);

  const filtered = logs.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.action || '').toLowerCase().includes(q) ||
      (l.entityType || '').toLowerCase().includes(q) ||
      (l.actorEmail || '').toLowerCase().includes(q)
    );
  });

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader title="Audit Logs" subtitle="Track who did what (create/update/delete) with timestamps." />

      <SectionCard>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <TextField
            size="small"
            placeholder="Search action/entity/email..."
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
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actor</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Entity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Entity ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No logs found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l._id} hover>
                    <TableCell>{moment(l.createdAt).format('DD MMM YYYY HH:mm')}</TableCell>
                    <TableCell>{l.actorEmail || '-'}</TableCell>
                    <TableCell sx={{ textTransform: 'uppercase', fontWeight: 700 }}>{l.action}</TableCell>
                    <TableCell>{l.entityType}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{l.entityId || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
    </Box>
  );
};

export default AuditLogs;
