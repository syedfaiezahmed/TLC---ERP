import express from 'express';
import { 
  authUser, 
  registerUser, 
  updateUserStatus, 
  updateUserPassword, 
  getUsers 
} from '../controllers/userController.js';
import { protect, superadmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.route('/')
  .post(registerUser)
  .get(protect, superadmin, getUsers);

router.put('/:id/status', protect, superadmin, updateUserStatus);
router.put('/:id/password', protect, superadmin, updateUserPassword);

export default router;
