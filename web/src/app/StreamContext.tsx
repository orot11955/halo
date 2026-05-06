import { createContext, useContext, type ReactNode } from 'react';
import { useStreamInvalidator } from '@/hooks/useStream';

interface StreamContextValue {
  connected: boolean;
}

const StreamContext = createContext<StreamContextValue>({ connected: false });

/**
 * Mount inside the authenticated branch only — we don't want the SSE
 * connection running on the login screen, since /api/v1/stream needs a
 * valid session anyway.
 */
export function StreamProvider({ children }: { children: ReactNode }) {
  const connected = useStreamInvalidator();
  return <StreamContext.Provider value={{ connected }}>{children}</StreamContext.Provider>;
}

export function useStreamConnection() {
  return useContext(StreamContext).connected;
}
