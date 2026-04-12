import express from 'express';
import {
  addLedgerEntry,
  getLedger,
  updateLedgerEntry,
  deleteLedgerEntry,
  addJournalEntry,
  syncLedger
} from '../controllers/ledgerController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, admin, addLedgerEntry);
router.route('/journal').post(protect, admin, addJournalEntry);
router.route('/sync/:companyId').post(protect, admin, syncLedger);
router.route('/company/:companyId').get(protect, admin, getLedger);
router
  .route('/:id')
  .put(protect, admin, updateLedgerEntry)
  .delete(protect, admin, deleteLedgerEntry);

export default router;
