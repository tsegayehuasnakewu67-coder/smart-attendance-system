import api from './api';

export const notificationService = {
  list: async () => (await api.get('/notifications')).data.data,
  send: async payload => (await api.post('/notifications', payload)).data,
  markRead: async id => (await api.patch(`/notifications/${id}/read`)).data.data,
};
