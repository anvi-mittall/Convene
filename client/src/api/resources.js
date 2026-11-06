import api from './client.js';

export async function uploadResource(eventId, formData) {
  const response = await api.post(`/events/${eventId}/resources`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

export async function fetchEventResources(eventId) {
  const response = await api.get(`/events/${eventId}/resources`);
  return response.data;
}

export async function downloadResource(resourceId) {
  const response = await api.get(`/resources/${resourceId}/download`, {
    responseType: 'blob'
  });
  return response;
}

export async function deleteResource(resourceId) {
  const response = await api.delete(`/resources/${resourceId}`);
  return response.data;
}
