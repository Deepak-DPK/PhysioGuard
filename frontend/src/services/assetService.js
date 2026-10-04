import api from './api';

export const assetService = {
  getAll: (params) => api.get('/assets', { params }),
  getById: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.patch(`/assets/${id}`, data),
  remove: (id) => api.delete(`/assets/${id}`),
  getTelemetry: (id, params) => api.get(`/assets/${id}/telemetry`, { params }),
  getHealthScore: (id) => api.get(`/assets/${id}/health-score`),
  getWorkOrders: (id) => api.get(`/assets/${id}/work-orders`),
  getInspections: (id) => api.get(`/assets/${id}/inspections`),
};
