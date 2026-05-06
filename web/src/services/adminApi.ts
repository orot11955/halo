import { ApiError, MOCK_MODE, request, delay } from './apiClient';

export interface IssuedToken {
  node_name: string;
  token: string;
}

export interface AppPairingCode {
  id: string;
  code: string;
  name: string;
  scopes: string[];
  expires_at: string;
}

export async function issueNodeToken(nodeName: string): Promise<IssuedToken> {
  if (MOCK_MODE) {
    return delay({ node_name: nodeName, token: 'mock-' + Math.random().toString(36).slice(2, 18) });
  }
  return request<IssuedToken>('/admin/tokens', {
    method: 'POST',
    body: JSON.stringify({ node_name: nodeName }),
  });
}

export async function issueAppPairingCode(input: {
  name?: string;
  expires_in_seconds?: number;
}): Promise<AppPairingCode> {
  if (MOCK_MODE) {
    return delay({
      id: 'mock-pairing',
      code: 'halo_pair_mock_' + Math.random().toString(36).slice(2, 18),
      name: input.name || 'Halo app',
      scopes: ['core:api', 'push:register'],
      expires_at: new Date(Date.now() + (input.expires_in_seconds ?? 300) * 1000).toISOString(),
    });
  }
  return request<AppPairingCode>('/mobile/pairing-codes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export { ApiError };
