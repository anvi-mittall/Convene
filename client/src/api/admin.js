import api from './client.js';

export async function fetchAdminStats() {
  const response = await api.get('/admin/stats');
  return response.data;
}

export async function fetchAdminUsers(params = {}) {
  const response = await api.get('/admin/users', { params });
  return response.data;
}

export async function updateUserRole(userId, role) {
  const response = await api.patch(`/admin/users/${userId}/role`, { role });
  return response.data;
}

export async function updateUserActiveStatus(userId, isActive) {
  const response = await api.patch(`/admin/users/${userId}/active`, { isActive });
  return response.data;
}
