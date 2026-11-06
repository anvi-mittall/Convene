import api from './client.js';

export async function registerForEvent(eventId) {
  const response = await api.post(`/events/${eventId}/register`);
  return response.data;
}

export async function cancelRegistration(eventId) {
  const response = await api.delete(`/events/${eventId}/register`);
  return response.data;
}

export async function fetchMyRegistrations(params = {}) {
  const response = await api.get('/registrations/mine', { params });
  return response.data;
}

export async function fetchRegistrationQr(registrationId) {
  const response = await api.get(`/registrations/${registrationId}/qr`);
  return response.data;
}

export async function fetchCertificate(registrationId) {
  const response = await api.get(`/registrations/${registrationId}/certificate`, {
    responseType: 'blob'
  });
  return response;
}

export async function fetchEventRegistrations(eventId, params = {}) {
  const response = await api.get(`/events/${eventId}/registrations`, { params });
  return response.data;
}

export async function updateAttendance(eventId, registrationId, attended) {
  const response = await api.patch(
    `/events/${eventId}/registrations/${registrationId}/attendance`,
    { attended }
  );
  return response.data;
}

export async function scanQrAttendance(eventId, qrToken) {
  const response = await api.post('/attendance/scan', { eventId, qrToken });
  return response.data;
}
