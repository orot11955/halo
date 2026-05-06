import { delay, MOCK_MODE, request } from './apiClient';
import { mockPorts } from '@/mocks/ports';
import type { NodePort } from '@/types/port';

export async function listPorts(node: string): Promise<NodePort[]> {
  if (MOCK_MODE) {
    const entry = mockPorts.find((p) => p.node === node);
    return delay(entry?.ports ?? []);
  }
  return request<NodePort[]>(`/nodes/${encodeURIComponent(node)}/ports`);
}
