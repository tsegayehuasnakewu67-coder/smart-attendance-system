import api from './api';

export const leaveService = {
  list: async (params = {}) => (await api.get('/leaves', { params })).data.data,
  create: async payload => (await api.post('/leaves', payload)).data,
  review: async (id, payload) => (await api.patch(`/leaves/${id}/review`, payload)).data,
};
