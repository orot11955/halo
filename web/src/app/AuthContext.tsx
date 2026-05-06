import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, MOCK_MODE, readSessionToken, setUnauthorizedHandler } from '@/services/apiClient';
import { login as apiLogin, logout as apiLogout, me as apiMe, type AuthUser } from '@/services/authApi';

interface AuthState {
  status: 'loading' | 'guest' | 'authenticated';
  user: AuthUser | null;
  error?: string;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<AuthState>(() => {
    const hasToken = Boolean(readSessionToken());
    return hasToken || !MOCK_MODE
      ? { status: 'loading', user: null }
      : { status: 'guest', user: null };
  });
  const initialFetched = useRef(false);

  // Resolve the current session on first mount. Browser sessions can be
  // backed by localStorage bearer tokens, while the native app injects the
  // HttpOnly halo_session cookie from Keychain before loading the WebView.
  useEffect(() => {
    if (initialFetched.current) return;
    initialFetched.current = true;
    if (MOCK_MODE && !readSessionToken()) return;
    apiMe()
      .then((user) => setState({ status: 'authenticated', user }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setState({ status: 'guest', user: null });
        } else {
          setState({ status: 'guest', user: null, error: (err as Error).message });
        }
      });
  }, []);

  // Hook the global 401 handler: if any request returns 401, clear state.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setState({ status: 'guest', user: null });
      qc.clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [qc]);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const user = await apiLogin(username, password);
        setState({ status: 'authenticated', user });
        qc.invalidateQueries();
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : (err as Error).message ?? 'Login failed';
        setState({ status: 'guest', user: null, error: message });
        throw err;
      }
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setState({ status: 'guest', user: null });
      qc.clear();
    }
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
