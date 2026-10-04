import api from './api';

export const sendMessage = (message, conversationHistory = []) =>
  api.post('/chat', { message, conversationHistory }).then(r => r.data);

export const getSuggestions = () =>
  api.get('/chat/suggestions').then(r => r.data);
