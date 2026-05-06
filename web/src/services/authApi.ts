import { MOCK_MODE, request, setSessionToken, delay } from './apiClient';

export interface AuthUser {
  username: string;
}

interface LoginResponse {
  token: string;
  expires_at: string;
  user: AuthUser;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  if (MOCK_MODE) {
    setSessionToken('mock-session');
    return delay({ username });
  }
  const res = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setSessionToken(res.token);
  return res.user;
}

export async function logout(): Promise<void> {
  if (MOCK_MODE) {
    setSessionToken(null);
    return delay(undefined);
  }
  try {
    await request<void>('/auth/logout', { method: 'POST' });
  } finally {
    setSessionToken(null);
  }
}

export async function me(): Promise<AuthUser> {
  if (MOCK_MODE) return delay({ username: 'mock-admin' });
  return request<AuthUser>('/auth/me');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (MOCK_MODE) return delay(undefined);
  await request<void>('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}
