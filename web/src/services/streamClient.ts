import { MOCK_MODE } from './apiClient';
import type { HaloEvent } from '@/types/event';
import { mockEvents } from '@/mocks/events';
import { mapEvent, type HalocEvent } from './halocAdapters';

export type StreamHandler = (event: HaloEvent) => void;

/**
 * Subscribe to the haloc SSE stream. Returns an unsubscribe function.
 * In mock mode, replays seed events on a slow timer.
 */
export function subscribeStream(onEvent: StreamHandler): () => void {
  if (MOCK_MODE) {
    let i = 0;
    const id = window.setInterval(() => {
      const sample = mockEvents[i % mockEvents.length];
      onEvent({
        ...sample,
        id: `${sample.id}-tick-${i}`,
        occurred_at: new Date().toISOString(),
      });
      i += 1;
    }, 12_000);
    return () => window.clearInterval(id);
  }

  const es = new EventSource('/api/v1/stream');
  const onMessage = (msg: MessageEvent) => {
    try {
      const parsed = JSON.parse(msg.data) as HalocEvent;
      if (typeof parsed.id !== 'number') return;
      onEvent(mapEvent(parsed));
    } catch {
      /* ignore malformed */
    }
  };
  [
    'node.online',
    'node.offline',
    'node.warning',
    'service.warning',
    'service.healthy',
    'domain.warning',
    'alert.created',
    'alert.resolved',
  ].forEach((type) => es.addEventListener(type, onMessage));
  return () => es.close();
}
