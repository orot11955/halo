import { delay, MOCK_MODE, request } from './apiClient';
import { mockContainers } from '@/mocks/containers';
import type { Container } from '@/types/container';

export async function listContainers(node: string): Promise<Container[]> {
  if (MOCK_MODE) return delay(mockContainers.filter((c) => c.node === node));
  return request<Container[]>(`/nodes/${encodeURIComponent(node)}/containers`);
}
