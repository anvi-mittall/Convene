import api from './client.js';

export async function submitFeedback(eventId, { rating, comment }) {
  const response = await api.post(`/events/${eventId}/feedback`, { rating, comment });
  return response.data;
}

export async function fetchEventFeedback(eventId, params = {}) {
  const response = await api.get(`/events/${eventId}/feedback`, { params });
  return response.data;
}
