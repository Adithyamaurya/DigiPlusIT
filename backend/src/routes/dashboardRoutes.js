import { Router } from 'express';
import { getDashboardData } from '../controllers/dashboardController.js';

const router = Router();

router.get('/', getDashboardData);

export default router;

