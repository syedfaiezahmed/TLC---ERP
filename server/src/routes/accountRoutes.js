import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../controllers/accountController.js';

const router = express.Router();

router.get('/company/:companyId', protect, admin, getAccounts);
router.post('/', protect, admin, createAccount);
router.put('/:id', protect, admin, updateAccount);
router.delete('/:id', protect, admin, deleteAccount);

export default router;

