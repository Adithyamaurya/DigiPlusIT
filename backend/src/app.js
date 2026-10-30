import express from 'express';
import cors from 'cors';
import correlationIdMiddleware from './middleware/correlationId.js';
import requestLogger from './middleware/requestLogger.js';
import { logError } from './utils/logger.js';

import projectRoutes from './routes/projectRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import workTransferRoutes from './routes/workTransferRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Health & Root check (support both /api/health and /health)
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    service: 'ContextFlow Backend',
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
};

app.get(['/api/health', '/health'], healthHandler);
app.get(['/api', '/'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'ContextFlow API Serverless',
    version: '1.0.0'
  });
});

// Resource Routes (support both /api/resource and /resource)
app.use(['/api/projects', '/projects'], projectRoutes);
app.use(['/api/meetings', '/meetings'], meetingRoutes);
app.use(['/api/tasks', '/tasks'], taskRoutes);
app.use(['/api/work-transfers', '/work-transfers'], workTransferRoutes);
app.use(['/api/documents', '/documents'], knowledgeRoutes);
app.use(['/api/ai', '/ai'], aiRoutes);
app.use(['/api/dashboard', '/dashboard'], dashboardRoutes);
app.use(['/api/users', '/users'], userRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.id
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  logError({
    requestId: req.id,
    endpoint: req.originalUrl,
    errorType: err.name || 'INTERNAL_SERVER_ERROR',
    message: err.message,
    stack: err.stack
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error occurred',
    code: err.code || 'SERVER_ERROR',
    requestId: req.id
  });
});

export default app;
