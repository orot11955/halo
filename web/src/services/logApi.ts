import { delay, MOCK_MODE, request } from './apiClient';
import { mockLogSources, mockLogTail } from '@/mocks/logs';
import type { LogLine, LogSource } from '@/types/log';

export async function listLogSources(node: string): Promise<LogSource[]> {
  if (MOCK_MODE) return delay(mockLogSources.filter((s) => s.node === node));
  return request<LogSource[]>(`/nodes/${encodeURIComponent(node)}/logs/sources`);
}

export async function listAllLogSources(): Promise<LogSource[]> {
  if (MOCK_MODE) return delay(mockLogSources);
  return request<LogSource[]>('/logs/sources');
}

export async function tailLog(node: string, sourceId: string, tail = 200): Promise<LogLine[]> {
  if (MOCK_MODE) return delay(mockLogTail[sourceId] ?? []);
  return request<LogLine[]>(
    `/nodes/${encodeURIComponent(node)}/logs/${encodeURIComponent(sourceId)}?tail=${tail}`,
  );
}
