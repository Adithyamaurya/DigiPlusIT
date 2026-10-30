import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach client-generated request ID & active persona user ID for tracking
api.interceptors.request.use((config) => {
  if (!config.headers['x-request-id']) {
    config.headers['x-request-id'] = 'req_' + Math.random().toString(36).substring(2, 11);
  }
  try {
    const activeUserId = localStorage.getItem('worktrace_user_id');
    if (activeUserId && !config.headers['x-user-id']) {
      config.headers['x-user-id'] = activeUserId;
    }
  } catch (e) {
    // ignore in environments without localStorage
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (typeof response.data === 'string' && (response.data.includes('<!doctype html') || response.data.includes('<!DOCTYPE html') || response.data.includes('<html'))) {
      return Promise.reject({
        message: 'Endpoint returned HTML instead of JSON. The backend serverless handler may be unreachable or restarting.',
        code: 'HTML_RESPONSE_ERROR',
        status: 200,
      });
    }
    return response.data;
  },
  (error) => {
    const errorData = error.response?.data || {};
    const message = (typeof errorData === 'object' && errorData.error) ? errorData.error : error.message || 'An unexpected error occurred';
    const code = errorData.code || 'UNKNOWN_ERROR';
    return Promise.reject({ message, code, status: error.response?.status, raw: error });
  }
);

export const DashboardAPI = {
  getStats: () => api.get('/dashboard'),
};

export const ProjectsAPI = {
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  getRisks: (id) => api.get(`/projects/${id}/risks`),
  getActivity: (id) => api.get(`/projects/${id}/activity`),
  getContextGraph: (id, params) => api.get(`/projects/${id}/context-graph`, { params }),
  getContextDiff: (id, params) => api.get(`/projects/${id}/context-graph/diff`, { params }),
  acknowledgeContext: (id, data) => api.post(`/projects/${id}/context-graph/acknowledge`, data),
};

export const MeetingsAPI = {
  getAll: (params) => api.get('/meetings', { params }),
  getById: (id) => api.get(`/meetings/${id}`),
  create: (data) => api.post('/meetings', data),
  update: (id, data) => api.put(`/meetings/${id}`, data),
  delete: (id) => api.delete(`/meetings/${id}`),
  getPendingCarryForward: (params) => api.get('/meetings/pending-carry-forward', { params }),
  previewRecap: (data) => api.post('/meetings/preview-recap', data),
  saveRecap: (id, data) => api.post(`/meetings/${id}/recap/save`, data),
};

export const TasksAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  updateStatus: (id, data) => api.patch(`/tasks/${id}/status`, data),
  assignOwner: (id, data) => api.patch(`/tasks/${id}/assign`, data),
  recordOutcome: (id, data) => api.post(`/tasks/${id}/outcome`, data),
  getHistory: (id) => api.get(`/tasks/${id}/history`),
};

export const WorkTransfersAPI = {
  getAll: (params) => api.get('/work-transfers', { params }),
  getById: (id) => api.get(`/work-transfers/${id}`),
  create: (data) => api.post('/work-transfers', data),
  acknowledge: (id, data) => api.patch(`/work-transfers/${id}/acknowledge`, data),
  getGaps: (id) => api.get(`/work-transfers/${id}/knowledge-gaps`),
};

export const CatchupAPI = {
  getProjectCatchup: (data) => api.post('/ai/project-catchup', data),
  getHandoffCatchup: (data) => api.post('/ai/handoff-catchup', data),
  getOnboardingBrief: (data) => api.post('/ai/onboarding-brief', data),
};

export const KnowledgeAPI = {
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  match: (params) => api.get('/documents/match', { params }),
  linkDecision: (data) => api.post('/documents/link-decision', data),
  ask: (data) => api.post('/documents/ask', data),
};

export const UsersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
};

export default api;
