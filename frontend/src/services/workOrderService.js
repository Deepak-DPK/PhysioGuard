import api from './api';

export const workOrderService = {
  getAll: (params) => api.get('/work-orders', { params }),
  getById: (id) => api.get(`/work-orders/${id}`),
  create: (data) => api.post('/work-orders', data),
  update: (id, data) => api.patch(`/work-orders/${id}`, data),
  approve: (id, reason) => api.post(`/work-orders/${id}/approve`, { reason }),
  reject: (id, reason) => api.post(`/work-orders/${id}/reject`, { reason }),
  close: (id) => api.post(`/work-orders/${id}/close`),
  uploadEvidence: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/work-orders/${id}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
