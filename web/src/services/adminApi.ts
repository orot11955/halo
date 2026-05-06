import { ApiError, MOCK_MODE, request, delay } from './apiClient';

export interface IssuedToken {
  node_name: string;
  token: string;
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

export { ApiError };
