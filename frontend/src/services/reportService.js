import api from './api';

export const reportService = {
  assetHealth: () => api.get('/reports/asset-health'),
  downtime: (params) => api.get('/reports/downtime', { params }),
  maintenanceEffectiveness: () => api.get('/reports/maintenance-effectiveness'),
  modelPerformance: () => api.get('/reports/model-performance'),
  exportReport: (type, format = 'csv', filters = {}) =>
    api.post('/reports/export', { type, format, ...filters }, {
      responseType: format === 'csv' ? 'blob' : 'json',
    }),
};
