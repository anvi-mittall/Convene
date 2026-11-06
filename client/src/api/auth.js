import api from './client.js';

export async function registerUser(userData) {
  const response = await api.post('/auth/register', userData);
  return response.data;
}

export async function loginUser(credentials) {
  const response = await api.post('/auth/login', credentials);
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data;
}
