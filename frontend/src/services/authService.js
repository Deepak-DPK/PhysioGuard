import api from './api';

export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
};
