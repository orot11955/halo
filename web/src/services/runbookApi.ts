import { delay, MOCK_MODE, ApiError, request } from './apiClient';
import { mockRunbooks } from '@/mocks/runbooks';
import type { Runbook, RunbookStatus, RunbookStep } from '@/types/runbook';

export interface RunbookWriteInput {
  title: string;
  summary?: string;
  tags?: string[];
  status?: RunbookStatus;
  scope?: string;
  steps?: RunbookStep[];
}

export async function listRunbooks(): Promise<Runbook[]> {
  if (MOCK_MODE) return delay(mockRunbooks);
  return request<Runbook[]>('/runbooks');
}

export async function getRunbook(id: string): Promise<Runbook> {
  if (MOCK_MODE) {
    const r = mockRunbooks.find((b) => b.id === id);
    if (!r) throw new ApiError(`Runbook not found: ${id}`, 'NOT_FOUND', 404);
    return delay(r);
  }
  return request<Runbook>(`/runbooks/${encodeURIComponent(id)}`);
}

export async function addRunbook(input: RunbookWriteInput): Promise<Runbook> {
  if (MOCK_MODE) {
    const created: Runbook = {
      id: `rb-${Date.now()}`,
      title: input.title,
      summary: input.summary ?? '',
      tags: input.tags ?? [],
      status: input.status ?? 'draft',
      scope: input.scope ?? '',
      steps: input.steps ?? [],
      updated_at: new Date().toISOString(),
    };
    mockRunbooks.unshift(created);
    return delay(created);
  }
  return request<Runbook>('/runbooks', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteRunbook(id: string): Promise<void> {
  if (MOCK_MODE) {
    const idx = mockRunbooks.findIndex((r) => r.id === id);
    if (idx >= 0) mockRunbooks.splice(idx, 1);
    return delay(undefined);
  }
  await request<void>(`/runbooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
