import api from './api';

export const aiService = {
  predictFailure: (asset_id) => api.post('/ai/predict-failure', { asset_id }),
  estimateRUL: (asset_id) => api.post('/ai/rul', { asset_id }),
  detectAnomalies: (asset_id, window_hours = 24) => api.post('/ai/anomaly', { asset_id, window_hours }),
  recogniseDefect: (asset_id, imageFile) => {
    const formData = new FormData();
    formData.append('asset_id', asset_id);
    formData.append('image', imageFile);
    return api.post('/ai/recognise-defect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  summariseNotes: (asset_id) => api.post('/ai/summarise-notes', { asset_id }),
  reviewRun: (runId, decision, reason) => api.post(`/ai/${runId}/review`, { decision, reason }),
  getRuns: (params) => api.get('/ai/runs', { params }),
};
