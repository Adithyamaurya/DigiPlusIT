import { Router } from 'express';
import {
  getAllWorkTransfers,
  getWorkTransferById,
  createWorkTransfer,
  acknowledgeWorkTransfer,
  getWorkTransferGaps
} from '../controllers/workTransferController.js';

const router = Router();

router.get('/', getAllWorkTransfers);
router.post('/', createWorkTransfer);
router.get('/:id', getWorkTransferById);
router.get('/:id/knowledge-gaps', getWorkTransferGaps);
router.patch('/:id/acknowledge', acknowledgeWorkTransfer);

export default router;
