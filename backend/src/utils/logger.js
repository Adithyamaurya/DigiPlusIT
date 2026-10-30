import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let logFileStream = null;
try {
  const isVercel = Boolean(process.env.VERCEL);
  const logDir = isVercel ? '/tmp/logs' : path.resolve(__dirname, '../../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFilePath = path.join(logDir, 'app.log');
  logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
} catch (err) {
  // Graceful fallback on read-only environments
}

// Create Pino instance with dual stream: pretty to console, structured JSON to file if writable
const streams = [
  ...(logFileStream ? [{ stream: logFileStream }] : []),
  { stream: process.stdout }
];

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    redact: ['headers.authorization', 'headers.cookie', 'password', 'apiKey', 'token']
  },
  pino.multistream(streams)
);

export const logEvent = (eventName, data = {}) => {
  logger.info({ event: eventName, ...data }, `[EVENT] ${eventName}`);
};

export const logAIOperation = ({ operation, requestId, startTime, success, latencyMs, errorCategory, metadata = {} }) => {
  const logPayload = {
    event: 'AI_OPERATION',
    operation,
    requestId,
    latencyMs: latencyMs ?? (Date.now() - startTime),
    success,
    errorCategory: errorCategory || null,
    ...metadata
  };
  
  if (success) {
    logger.info(logPayload, `[AI] ${operation} completed in ${logPayload.latencyMs}ms`);
  } else {
    logger.error(logPayload, `[AI] ${operation} failed after ${logPayload.latencyMs}ms: ${errorCategory || 'Unknown error'}`);
  }
};

export const logError = ({ requestId, endpoint, errorType, message, stack, context = {} }) => {
  logger.error(
    {
      event: 'APPLICATION_ERROR',
      requestId,
      endpoint,
      errorType,
      message,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      ...context
    },
    `[ERROR] ${errorType}: ${message}`
  );
};

export default logger;

