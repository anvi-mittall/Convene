import api from './client.js';

export async function fetchEvents(params = {}) {
  const response = await api.get('/events', { params });
  return response.data;
}

export async function fetchMyEvents(params = {}) {
  const response = await api.get('/events/mine', { params });
  return response.data;
}

export async function fetchEventById(id) {
  const response = await api.get(`/events/${id}`);
  return response.data;
}

export async function createEvent(formData) {
  const response = await api.post('/events', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

export async function updateEvent(id, formData) {
  const response = await api.put(`/events/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

export async function cancelEvent(id) {
  const response = await api.post(`/events/${id}/cancel`);
  return response.data;
}

export async function deleteEvent(id) {
  const response = await api.delete(`/events/${id}`);
  return response.data;
}

export async function fetchEventStats(id) {
  const response = await api.get(`/events/${id}/stats`);
  return response.data;
}
