import { delay, MOCK_MODE, ApiError, request } from './apiClient';
import { mockNodes } from '@/mocks/nodes';
import type { Node } from '@/types/node';
import { mapNode, type HalocNode, type HalocNodeSummary } from './halocAdapters';

export interface AddNodeInput {
  name: string;
  display_name?: string;
  role?: string;
  url: string;
  ip_address?: string;
}

export async function listNodes(): Promise<Node[]> {
  if (MOCK_MODE) return delay(mockNodes);
  const nodes = await request<HalocNode[]>('/nodes');
  return nodes.map((node) => mapNode(node));
}

export async function getNode(name: string): Promise<Node> {
  if (MOCK_MODE) {
    const node = mockNodes.find((n) => n.name === name);
    if (!node) throw new ApiError(`Node not found: ${name}`, 'NOT_FOUND', 404);
    return delay(node);
  }
  const summary = await request<HalocNodeSummary>(`/nodes/${encodeURIComponent(name)}/summary`);
  return mapNode(summary.node, summary.current_metrics);
}

export async function addNode(input: AddNodeInput): Promise<Node> {
  if (MOCK_MODE) {
    throw new ApiError('Mock mode does not support node creation', 'MOCK_READONLY', 400);
  }
  const node = await request<HalocNode>('/nodes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return mapNode(node);
}

export async function deleteNode(name: string): Promise<void> {
  if (MOCK_MODE) {
    throw new ApiError('Mock mode does not support node deletion', 'MOCK_READONLY', 400);
  }
  await request<void>(`/nodes/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function refreshNode(name: string): Promise<void> {
  if (MOCK_MODE) return delay(undefined);
  await request<unknown>(`/nodes/${encodeURIComponent(name)}/refresh`, { method: 'POST' });
}
