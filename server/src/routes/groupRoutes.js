import express from 'express';
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  seedDefaultGroups,
} from '../controllers/groupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/company/:companyId', listGroups);
router.post('/seed-defaults/:companyId', seedDefaultGroups);
router.post('/', createGroup);
router.get('/:id', getGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

export default router;
