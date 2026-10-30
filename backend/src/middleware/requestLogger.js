import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = req.id;

  logger.info({
    event: 'REQUEST_START',
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
  }, `Incoming ${req.method} ${req.originalUrl || req.url}`);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level]({
      event: 'REQUEST_COMPLETE',
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
    }, `Completed ${req.method} ${req.originalUrl || req.url} with ${res.statusCode} in ${durationMs}ms`);
  });

  next();
};

export default requestLogger;

