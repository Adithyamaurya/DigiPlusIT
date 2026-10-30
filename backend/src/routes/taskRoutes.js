import { Router } from 'express';
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  assignTaskOwner,
  recordTaskOutcome,
  getTaskHistory
} from '../controllers/taskController.js';

const router = Router();

router.get('/', getAllTasks);
router.post('/', createTask);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
router.patch('/:id/assign', assignTaskOwner);
router.post('/:id/outcome', recordTaskOutcome);
router.get('/:id/history', getTaskHistory);

export default router;

