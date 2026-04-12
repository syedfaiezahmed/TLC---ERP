import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  alpha,
  useTheme,
  CircularProgress,
  TextField,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  page = 0,
  rowsPerPage = 10,
  totalCount = 0,
  onPageChange,
  onRowsPerPageChange,
  onSearch,
  searchPlaceholder = 'Search...',
  actions,
  emptyMessage = 'No data available',
  enableSearch = true,
  enablePagination = true,
  stickyHeader = true,
  dense = false
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        width: '100%', 
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1
      }}
    >
      {enableSearch && (
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 400 }}
          />
        </Box>
      )}

      <TableContainer sx={{ maxHeight: dense ? 400 : 600 }}>
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                  sx={{
                    fontWeight: 700,
                    bgcolor: alpha(theme.palette.background.default, 0.6),
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
              {actions && (
                <TableCell 
                  align="right"
                  sx={{
                    fontWeight: 700,
                    bgcolor: alpha(theme.palette.background.default, 0.6),
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  ACTIONS
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} align="center" sx={{ py: 8 }}>
                  <CircularProgress size={32} thickness={4} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} align="center" sx={{ py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow 
                  hover 
                  key={row.id || index}
                  sx={{
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.02)
                    }
                  }}
                >
                  {columns.map((column) => {
                    const value = row[column.id];
                    return (
                      <TableCell key={column.id} align={column.align || 'left'}>
                        {column.format ? column.format(value, row) : value}
                      </TableCell>
                    );
                  })}
                  {actions && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        {actions(row)}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {enablePagination && !loading && data.length > 0 && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              fontSize: '0.8125rem',
              fontWeight: 500
            }
          }}
        />
      )}
    </Paper>
  );
};

export default DataTable;
