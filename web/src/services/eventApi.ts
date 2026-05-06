import { delay, MOCK_MODE, request } from './apiClient';
import { mockEvents } from '@/mocks/events';
import type { HaloEvent } from '@/types/event';
import { mapEvent, type HalocEvent } from './halocAdapters';

export async function listEvents(): Promise<HaloEvent[]> {
  if (MOCK_MODE) return delay(mockEvents);
  const events = await request<HalocEvent[]>('/events/history');
  return events.map(mapEvent);
}

export async function resolveEvent(id: string): Promise<HaloEvent> {
  if (MOCK_MODE) {
    const event = mockEvents.find((e) => e.id === id);
    return delay({
      ...(event ?? mockEvents[0]),
      id,
      resolved: true,
    });
  }
  const event = await request<HalocEvent>(`/events/${encodeURIComponent(id)}/resolve`, {
    method: 'PATCH',
  });
  return mapEvent(event);
}
