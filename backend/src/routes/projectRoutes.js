import { Router } from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectRisks,
  getProjectActivity
} from '../controllers/projectController.js';
import { 
  getProjectContextGraph, 
  compareProjectContextGraph, 
  acknowledgeProjectContext 
} from '../controllers/contextGraphController.js';

const router = Router();

router.get('/', getAllProjects);
router.post('/', createProject);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.get('/:id/risks', getProjectRisks);
router.get('/:id/activity', getProjectActivity);
router.get('/:id/context-graph', getProjectContextGraph);
router.get('/:id/context-graph/diff', compareProjectContextGraph);
router.post('/:id/context-graph/acknowledge', acknowledgeProjectContext);

export default router;
