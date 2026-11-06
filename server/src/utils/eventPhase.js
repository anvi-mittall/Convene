export function computeEventPhase(event, now = new Date()) {
  if (event.status === 'cancelled') {
    return 'cancelled';
  }

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  if (now < start) {
    return 'upcoming';
  } else if (now >= start && now < end) {
    return 'ongoing';
  } else {
    return 'completed';
  }
}

export function enrichEvent(eventDoc, now = new Date()) {
  if (!eventDoc) return null;
  const event = eventDoc.toObject ? eventDoc.toObject() : { ...eventDoc };
  event.phase = computeEventPhase(event, now);
  event.seatsLeft = Math.max(0, event.capacity - (event.confirmedCount || 0));
  return event;
}
