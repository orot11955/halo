import { delay, MOCK_MODE, ApiError, request } from './apiClient';
import { mockDomains } from '@/mocks/domains';
import type { Domain } from '@/types/domain';
import { mapDomain, type HalocDomain, type HalocService } from './halocAdapters';

export interface DomainWriteInput {
  name?: string;
  service_id?: number;
  expected_ip?: string;
}

export async function listDomains(): Promise<Domain[]> {
  if (MOCK_MODE) return delay(mockDomains);
  const [domains, services] = await Promise.all([
    request<HalocDomain[]>('/domains'),
    request<HalocService[]>('/services'),
  ]);
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));
  return domains.map((domain) =>
    mapDomain({
      ...domain,
      service_name: domain.service_id ? serviceNames.get(domain.service_id) : undefined,
    }),
  );
}

export async function addDomain(input: DomainWriteInput): Promise<Domain> {
  if (MOCK_MODE) {
    throw new ApiError('Mock mode does not support domain creation', 'MOCK_READONLY', 400);
  }
  const created = await request<HalocDomain>('/domains', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return mapDomain(created);
}

export async function deleteDomain(name: string): Promise<void> {
  if (MOCK_MODE) {
    throw new ApiError('Mock mode does not support domain deletion', 'MOCK_READONLY', 400);
  }
  await request<void>(`/domains/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function checkDomain(name: string): Promise<void> {
  if (MOCK_MODE) return delay(undefined);
  await request<unknown>(`/domains/${encodeURIComponent(name)}/check`, { method: 'POST' });
}
