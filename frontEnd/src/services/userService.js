import api from './api';

const normalizeCollectionResponse = (payload = {}) => {
  const employees = payload.employees ?? payload.users ?? [];
  const pagination = payload.pagination ?? {
    total: employees.length,
    page: 1,
    limit: employees.length || 1,
    totalPages: 1,
  };

  return { employees, pagination };
};

const normalizeSingleResponse = (payload = {}) => payload.user ?? payload.employee ?? payload;

export const userService = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/users', { params });
    return normalizeCollectionResponse(data?.data ?? data);
  },

  getById: async (id) => {
    const { data } = await api.get(`/users/${id}`);
    return normalizeSingleResponse(data?.data ?? data);
  },

  create: async (payload) => {
    const { data } = await api.post('/employees', payload);
    return data?.data?.employee ?? data?.data?.user ?? data?.data ?? data;
  },

  update: async (id, payload) => {
    const { data } = await api.put(`/users/${id}`, payload);
    return normalizeSingleResponse(data?.data ?? data);
  },

  remove: async (id) => (await api.delete(`/users/${id}`)).data,
  updateFace: async (id, faceDescriptor) => (await api.patch(`/users/${id}/face`, { faceDescriptor })).data.data.user,
  getDepartments: async () => (await api.get('/users/departments')).data.data.departments,
};
