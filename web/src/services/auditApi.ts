import { delay, MOCK_MODE, request } from './apiClient';
import { mockAuditLog, mockMaintenance } from '@/mocks/audit';
import type { AuditEntry, MaintenanceWindow } from '@/types/audit';

export interface AddMaintenanceInput {
  title: string;
  scope?: string;
  state?: string;
  starts_at: string;
  ends_at: string;
  note?: string;
}

export async function listAuditLog(): Promise<AuditEntry[]> {
  if (MOCK_MODE) return delay(mockAuditLog);
  return request<AuditEntry[]>('/audit');
}

export async function listMaintenance(): Promise<MaintenanceWindow[]> {
  if (MOCK_MODE) return delay(mockMaintenance);
  return request<MaintenanceWindow[]>('/maintenance');
}

export async function addMaintenance(input: AddMaintenanceInput): Promise<MaintenanceWindow> {
  if (MOCK_MODE) {
    const created: MaintenanceWindow = {
      id: `m-${Date.now()}`,
      title: input.title,
      scope: input.scope ?? '',
      state: (input.state as MaintenanceWindow['state']) ?? 'scheduled',
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      note: input.note ?? '',
    };
    mockMaintenance.unshift(created);
    return delay(created);
  }
  return request<MaintenanceWindow>('/maintenance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteMaintenance(id: string): Promise<void> {
  if (MOCK_MODE) {
    const idx = mockMaintenance.findIndex((m) => m.id === id);
    if (idx >= 0) mockMaintenance.splice(idx, 1);
    return delay(undefined);
  }
  await request<void>(`/maintenance/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
