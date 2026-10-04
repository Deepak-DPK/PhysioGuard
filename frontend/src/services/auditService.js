import api from './api';

export const auditService = {
  getAll: (params) => api.get('/audit-logs', { params }),
  getSystemConfig: () => api.get('/audit-logs/system-config'),
  updateSystemConfig: (key, value) => api.patch(`/audit-logs/system-config/${key}`, { value }),
};
