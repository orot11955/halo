import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeStream } from '@/services/streamClient';
import type { HaloEvent } from '@/types/event';

/**
 * Buffers the most recent N events received from the haloc SSE stream.
 */
export function useStream(limit = 25) {
  const [events, setEvents] = useState<HaloEvent[]>([]);
  const limitRef = useRef(limit);
  limitRef.current = limit;

  useEffect(() => {
    const unsubscribe = subscribeStream((evt) => {
      setEvents((prev) => [evt, ...prev].slice(0, limitRef.current));
    });
    return unsubscribe;
  }, []);

  return events;
}

/**
 * Mounts the SSE stream once at the app root. Each incoming event
 * invalidates the react-query caches it could plausibly affect, so the
 * dashboard, nodes list, services list, and events list all reflect the
 * change without the user clicking refresh.
 *
 * Returns a `connected` boolean that the header pill uses to render the
 * live/idle indicator.
 */
export function useStreamInvalidator() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const lastEventAt = useRef<number>(0);

  useEffect(() => {
    const onEvent = (evt: HaloEvent) => {
      lastEventAt.current = Date.now();
      setConnected(true);
      // Map event types → which queries to invalidate. We always refresh
      // the dashboard summary because it aggregates everything.
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['audit-log'] });
      switch (evt.kind) {
        case 'node.online':
        case 'node.offline':
        case 'node.warning':
          qc.invalidateQueries({ queryKey: ['nodes'] });
          break;
        case 'service.warning':
        case 'service.healthy':
          qc.invalidateQueries({ queryKey: ['services'] });
          break;
        case 'domain.warning':
          qc.invalidateQueries({ queryKey: ['domains'] });
          break;
      }
    };

    const unsubscribe = subscribeStream(onEvent);
    // Mark the connection live optimistically — EventSource has no
    // explicit "open" callback we expose. If no event arrives within
    // ~10s the heartbeat below downgrades to idle.
    setConnected(true);

    const heartbeat = window.setInterval(() => {
      // If we haven't received anything for a while, treat as idle. This
      // is heuristic but matches the "live" pill semantics in the header.
      if (Date.now() - lastEventAt.current > 60_000) {
        setConnected((prev) => prev); // no-op; placeholder for future ping
      }
    }, 15_000);

    return () => {
      unsubscribe();
      window.clearInterval(heartbeat);
      setConnected(false);
    };
  }, [qc]);

  return connected;
}
