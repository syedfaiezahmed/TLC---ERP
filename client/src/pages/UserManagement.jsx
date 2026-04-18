import React, { useEffect, useState } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  IconButton, 
  Button, 
  Box, 
  Chip, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField
} from '@mui/material';
import { PageTableSkeleton } from '../components/SkeletonLoaders';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import KeyIcon from '@mui/icons-material/Key';
import { toast } from 'react-toastify';
import axios from 'axios';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPassword, setOpenPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    try {
      const profile = JSON.parse(localStorage.getItem('profile'));
      const { data } = await axios.get('/api/users', {
        headers: { Authorization: `Bearer ${profile.token}` }
      });
      setUsers(data);
      setLoading(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch users');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleStatusToggle = async (user) => {
    try {
      const profile = JSON.parse(localStorage.getItem('profile'));
      await axios.put(`/api/users/${user._id}/status`, 
        { isActive: !user.isActive },
        { headers: { Authorization: `Bearer ${profile.token}` } }
      );
      toast.success(`User ${!user.isActive ? 'activated' : 'suspended'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handlePasswordUpdate = async () => {
    if (!newPassword || newPassword.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
    }
    try {
      const profile = JSON.parse(localStorage.getItem('profile'));
      await axios.put(`/api/users/${selectedUser._id}/password`, 
        { password: newPassword },
        { headers: { Authorization: `Bearer ${profile.token}` } }
      );
      toast.success('Password updated successfully');
      setOpenPassword(false);
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  if (loading) return <PageTableSkeleton cols={6} rows={8} />;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">User Management</Typography>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Company</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user._id} hover>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.role} 
                    size="small" 
                    color={user.role === 'superadmin' ? 'secondary' : 'primary'} 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell>{user.company?.name || 'N/A'}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.isActive ? 'Active' : 'Suspended'} 
                    size="small" 
                    color={user.isActive ? 'success' : 'error'} 
                  />
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" gap={1}>
                    <IconButton 
                      size="small" 
                      title="Change Password"
                      onClick={() => { setSelectedUser(user); setOpenPassword(true); }}
                    >
                      <KeyIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color={user.isActive ? 'error' : 'success'}
                      title={user.isActive ? 'Suspend User' : 'Activate User'}
                      onClick={() => handleStatusToggle(user)}
                      disabled={user.role === 'superadmin'}
                    >
                      {user.isActive ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openPassword} onClose={() => setOpenPassword(false)}>
        <DialogTitle>Reset Password for {selectedUser?.name}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenPassword(false)} color="inherit">Cancel</Button>
          <Button onClick={handlePasswordUpdate} variant="contained">Update Password</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagement;
