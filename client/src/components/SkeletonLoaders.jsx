import React from 'react';
import {
  Skeleton, Box, TableRow, TableCell, Grid, Card,
  CardContent, Stack, Paper,
} from '@mui/material';

// ─── Table Rows Skeleton ──────────────────────────────────────────────────────
// Drop this directly inside <TableBody> in place of a CircularProgress cell.
export const TableRowSkeleton = ({ rows = 6, cols = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <TableCell key={j} sx={{ py: 1.2 }}>
            <Skeleton
              animation="wave"
              height={18}
              width={j === 0 ? '70%' : j === cols - 1 ? '40%' : `${60 + Math.random() * 30}%`}
              sx={{ borderRadius: 1 }}
            />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

// ─── Stat Card Grid Skeleton ──────────────────────────────────────────────────
// Replaces the 4-card stat row while loading (Courses page, etc.)
export const StatCardGridSkeleton = ({ count = 4 }) => (
  <Grid container spacing={2} sx={{ mb: 2 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Grid item xs={12} sm={6} md={3} key={i}>
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: 1 }}>
          <CardContent sx={{ pb: '12px !important' }}>
            <Skeleton width="55%" height={14} sx={{ mb: 1.5, borderRadius: 1 }} />
            <Skeleton width="40%" height={32} sx={{ borderRadius: 1 }} />
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// ─── Full-Page Table Skeleton ─────────────────────────────────────────────────
// Replaces early-return spinner (e.g. UserManagement, full-page loading)
export const PageTableSkeleton = ({ cols = 5, rows = 7 }) => (
  <Box sx={{ p: 3 }}>
    {/* header bar */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
      <Skeleton width={200} height={32} sx={{ borderRadius: 2 }} />
      <Skeleton width={120} height={36} sx={{ borderRadius: 2 }} />
    </Box>
    {/* table */}
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      {/* fake header */}
      <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1.5, display: 'flex', gap: 3 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${80 + i * 10}px`} height={16} sx={{ borderRadius: 1 }} />
        ))}
      </Box>
      {/* fake rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            px: 2, py: 1.2, display: 'flex', gap: 3,
            borderTop: '1px solid', borderColor: 'divider',
          }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              animation="wave"
              width={`${60 + j * 8}px`}
              height={18}
              sx={{ borderRadius: 1 }}
            />
          ))}
        </Box>
      ))}
    </Paper>
  </Box>
);

// ─── Report / Content Block Skeleton ─────────────────────────────────────────
// Replaces CircularProgress inside the Reports content pane
export const ReportSkeleton = () => (
  <Box sx={{ py: 2 }}>
    {/* summary line */}
    <Skeleton width="30%" height={22} sx={{ mb: 3, borderRadius: 1 }} />
    {/* table-like rows */}
    {Array.from({ length: 10 }).map((_, i) => (
      <Box key={i} sx={{ display: 'flex', gap: 3, py: 0.8, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Skeleton animation="wave" width="25%" height={16} sx={{ borderRadius: 1 }} />
        <Skeleton animation="wave" width="15%" height={16} sx={{ borderRadius: 1 }} />
        <Skeleton animation="wave" width="20%" height={16} sx={{ borderRadius: 1 }} />
        <Skeleton animation="wave" width="12%" height={16} sx={{ borderRadius: 1, ml: 'auto' }} />
        <Skeleton animation="wave" width="10%" height={16} sx={{ borderRadius: 1 }} />
      </Box>
    ))}
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 2 }}>
      <Skeleton width={100} height={20} sx={{ borderRadius: 1 }} />
      <Skeleton width={80} height={20} sx={{ borderRadius: 1 }} />
    </Box>
  </Box>
);

// ─── Payroll Cards Skeleton ───────────────────────────────────────────────────
export const PayrollTableSkeleton = ({ rows = 5 }) => (
  <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
    <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1.5, display: 'flex', gap: 3 }}>
      {[160, 100, 90, 100, 90, 80, 80, 60].map((w, i) => (
        <Skeleton key={i} width={w} height={16} sx={{ borderRadius: 1 }} />
      ))}
    </Box>
    {Array.from({ length: rows }).map((_, i) => (
      <Box key={i} sx={{ px: 2, py: 1.5, display: 'flex', gap: 3, borderTop: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Skeleton animation="wave" variant="circular" width={32} height={32} sx={{ flexShrink: 0 }} />
        <Skeleton animation="wave" width={140} height={18} sx={{ borderRadius: 1 }} />
        <Skeleton animation="wave" width={80} height={18} sx={{ borderRadius: 1 }} />
        <Skeleton animation="wave" width={90} height={18} sx={{ borderRadius: 1 }} />
        <Skeleton animation="wave" width={80} height={22} sx={{ borderRadius: 2 }} />
        <Skeleton animation="wave" width={60} height={18} sx={{ borderRadius: 1, ml: 'auto' }} />
      </Box>
    ))}
  </Paper>
);

// ─── Dialog Content Skeleton ──────────────────────────────────────────────────
// Replaces CircularProgress inside a Dialog body
export const DialogContentSkeleton = ({ rows = 5 }) => (
  <Box sx={{ py: 1 }}>
    {Array.from({ length: rows }).map((_, i) => (
      <Box key={i} sx={{ mb: 2 }}>
        <Skeleton width="35%" height={12} sx={{ mb: 0.8, borderRadius: 1 }} />
        <Skeleton animation="wave" width="100%" height={40} sx={{ borderRadius: 1 }} />
      </Box>
    ))}
  </Box>
);

// ─── App Shell Skeleton (Dashboard init) ─────────────────────────────────────
export const AppShellSkeleton = () => (
  <Box sx={{ display: 'flex', minHeight: '100vh' }}>
    {/* sidebar */}
    <Box sx={{ width: 240, flexShrink: 0, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', p: 2 }}>
      <Skeleton width={120} height={36} sx={{ mb: 3, borderRadius: 2 }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Skeleton variant="circular" width={22} height={22} />
          <Skeleton width={100} height={16} sx={{ borderRadius: 1 }} />
        </Box>
      ))}
    </Box>
    {/* main */}
    <Box sx={{ flex: 1, p: 3 }}>
      <Skeleton width={250} height={28} sx={{ mb: 3, borderRadius: 2 }} />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Skeleton width="50%" height={14} sx={{ mb: 1 }} />
                <Skeleton width="35%" height={28} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Box key={i} sx={{ px: 2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 3 }}>
            {[140, 100, 110, 90, 70].map((w, j) => (
              <Skeleton key={j} animation="wave" width={w} height={16} sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        ))}
      </Paper>
    </Box>
  </Box>
);

// ─── Inline Content Skeleton (Suspense fallback) ──────────────────────────────
export const SuspenseFallback = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton width={200} height={28} sx={{ mb: 2.5, borderRadius: 2 }} />
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Skeleton animation="wave" height={80} sx={{ borderRadius: 3 }} />
        </Grid>
      ))}
    </Grid>
    <Skeleton animation="wave" height={320} sx={{ borderRadius: 3 }} />
  </Box>
);
