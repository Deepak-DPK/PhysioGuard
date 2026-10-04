import api from './api';

export const technicianService = {
  getAll: () => api.get('/technicians'),
  getQueue: (params) => api.get('/technicians/queue', { params }),
};
