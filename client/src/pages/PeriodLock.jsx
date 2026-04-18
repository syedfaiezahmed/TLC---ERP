import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Box, Button, CardContent, Divider, TextField, Typography } from '@mui/material';
import { DialogContentSkeleton } from '../components/SkeletonLoaders';
import { clearPeriodLock, fetchPeriodLock, setPeriodLock } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

const PeriodLock = () => {
  const { companyId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lock, setLock] = useState({ lockedUntil: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchPeriodLock(companyId);
      setLock({
        lockedUntil: data.lockedUntil ? data.lockedUntil.slice(0, 10) : '',
        reason: data.reason || '',
      });
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) load();
  }, [companyId, load]);

  const handleSave = async () => {
    if (!lock.lockedUntil) return toast.error('Please select locked until date');
    setSaving(true);
    try {
      await setPeriodLock(companyId, { lockedUntil: lock.lockedUntil, reason: lock.reason });
      toast.success('Posting lock updated');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await clearPeriodLock(companyId);
      toast.success('Posting lock cleared');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader
        title="Period Closing / Posting Lock"
        subtitle="Lock posting up to a date so no back-dated vouchers can be posted."
      />

      <SectionCard title="Current Lock Settings">
        <CardContent sx={{ p: 3 }}>
          {loading ? (
            <DialogContentSkeleton rows={3} />
          ) : (
            <>
              <TextField
                type="date"
                label="Locked Until"
                fullWidth
                value={lock.lockedUntil}
                onChange={(e) => setLock({ ...lock, lockedUntil: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Reason (Optional)"
                fullWidth
                value={lock.reason}
                onChange={(e) => setLock({ ...lock, reason: e.target.value })}
                sx={{ mb: 2 }}
              />
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" color="error" onClick={handleClear} disabled={saving}>
                  Clear Lock
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  Save
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </SectionCard>
    </Box>
  );
};

export default PeriodLock;
