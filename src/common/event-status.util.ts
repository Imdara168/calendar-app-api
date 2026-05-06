export type EventStatus = 'upcoming' | 'in-progress' | 'completed';

export function getCurrentDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getCurrentTimeString(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export function resolveEventStatus(
  eventDate: string,
  startTime: string,
  endTime: string,
): EventStatus {
  const today = getCurrentDateString();
  const currentTime = getCurrentTimeString();

  if (eventDate < today) {
    return 'completed';
  }

  if (eventDate === today && endTime <= currentTime) {
    return 'completed';
  }

  if (
    eventDate === today &&
    startTime <= currentTime &&
    currentTime < endTime
  ) {
    return 'in-progress';
  }

  return 'upcoming';
}
