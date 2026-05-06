export const MOCK_MODE = import.meta.env.VITE_HALO_MOCK === 'true';
export const MOCK_LATENCY_MS = 220;

const TOKEN_KEY = 'halo.session.token';

let cachedToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function readSessionToken(): string | null {
  if (cachedToken !== null) return cachedToken;
  try {
    cachedToken = localStorage.getItem(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export function setSessionToken(token: string | null) {
  cachedToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Register a global handler invoked whenever an API call returns 401.
 * The AuthProvider uses this to drop the cached user and redirect.
 */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN',
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isFeatureDisabledError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (
      error.code === 'FEATURE_DISABLED' ||
      error.message.toLowerCase().includes('endpoint is disabled')
    );
  }
  return false;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const token = readSessionToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    // Drop the bad token and notify the app so it can redirect to login.
    setSessionToken(null);
    onUnauthorized?.();
    let body: { code?: string; message?: string; error?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* noop */
    }
    throw new ApiError(
      body.message ?? body.error ?? 'unauthorized',
      body.code ?? 'UNAUTHORIZED',
      401,
    );
  }
  if (!res.ok) {
    let body: { code?: string; message?: string; error?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* noop */
    }
    throw new ApiError(body.message ?? body.error ?? res.statusText, body.code ?? 'HTTP_ERROR', res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
