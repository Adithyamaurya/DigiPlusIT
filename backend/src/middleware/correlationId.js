import { randomUUID } from 'crypto';

export const correlationIdMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-request-id'] || req.headers['x-correlation-id'] || randomUUID();
  req.id = correlationId;
  res.setHeader('X-Request-ID', correlationId);
  next();
};

export default correlationIdMiddleware;

