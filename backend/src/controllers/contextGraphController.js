import { 
  generateProjectContextGraph, 
  compareProjectContext, 
  acknowledgeUserContext 
} from '../services/contextGraphService.js';
import { logError, logEvent } from '../utils/logger.js';

export async function getProjectContextGraph(req, res) {
  const { id } = req.params;
  const { memberId, userId } = req.query;
  const activeUserId = userId || req.headers['x-user-id'] || null;

  try {
    const graphData = await generateProjectContextGraph(id, { memberId, userId: activeUserId });
    res.json({ success: true, data: graphData });
  } catch (err) {
    logError({
      requestId: req.id,
      endpoint: req.originalUrl,
      errorType: 'CONTEXT_GRAPH_ERROR',
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ success: false, error: err.message || 'Failed to generate context graph' });
  }
}

export async function compareProjectContextGraph(req, res) {
  const { id } = req.params;
  const { fromEventId, toEventId } = req.query;

  if (!fromEventId || !toEventId) {
    return res.status(400).json({ success: false, error: 'fromEventId and toEventId are required' });
  }

  try {
    const diffData = await compareProjectContext(id, fromEventId, toEventId);
    res.json({ success: true, data: diffData });
  } catch (err) {
    logError({
      requestId: req.id,
      endpoint: req.originalUrl,
      errorType: 'CONTEXT_DIFF_ERROR',
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ success: false, error: err.message || 'Failed to compare contexts' });
  }
}

export async function acknowledgeProjectContext(req, res) {
  const { id } = req.params;
  const { eventId, userId } = req.body;
  const targetUserId = userId || req.headers['x-user-id'];

  if (!targetUserId) {
    return res.status(400).json({ success: false, error: 'userId or x-user-id header is required to acknowledge context' });
  }

  try {
    const position = await acknowledgeUserContext(id, targetUserId, eventId || null);
    logEvent('USER_CONTEXT_ACKNOWLEDGED', { projectId: id, userId: targetUserId, eventId, requestId: req.id });
    res.json({ success: true, data: position, message: 'Context position updated successfully' });
  } catch (err) {
    logError({
      requestId: req.id,
      endpoint: req.originalUrl,
      errorType: 'CONTEXT_ACK_ERROR',
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ success: false, error: err.message || 'Failed to acknowledge context' });
  }
}

export default {
  getProjectContextGraph,
  compareProjectContextGraph,
  acknowledgeProjectContext
};
