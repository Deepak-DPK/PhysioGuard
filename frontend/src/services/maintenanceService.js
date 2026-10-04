import api from './api';

export const maintenanceService = {
  getAll: (params) => api.get('/maintenance-plans', { params }),
  create: (data) => api.post('/maintenance-plans', data),
  update: (id, data) => api.patch(`/maintenance-plans/${id}`, data),
  getCalendar: (params) => api.get('/maintenance-plans/calendar', { params }),
};
