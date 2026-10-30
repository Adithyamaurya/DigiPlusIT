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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ContextFlow Backend',
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

// Resource Routes
app.use('/api/projects', projectRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/work-transfers', workTransferRoutes);
app.use('/api/documents', knowledgeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

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

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    error: err.message || 'An unexpected internal server error occurred',
    requestId: req.id
  });
});

export default app;

