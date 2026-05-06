import { delay, MOCK_MODE, ApiError, request } from './apiClient';
import { mockServices } from '@/mocks/services';
import type { Service } from '@/types/service';
import {
  mapService,
  type HalocDomain,
  type HalocNode,
  type HalocService,
} from './halocAdapters';

export interface ServiceWriteInput {
  name?: string;
  node_id?: number;
  node_name?: string;
  kind?: string;
  port?: number;
  domain_id?: number;
  health_check_url?: string;
  health_status?: string;
  note?: string;
}

export async function listServices(): Promise<Service[]> {
  if (MOCK_MODE) return delay(mockServices);
  const [services, nodes, domains] = await Promise.all([
    request<HalocService[]>('/services'),
    request<HalocNode[]>('/nodes'),
    request<HalocDomain[]>('/domains'),
  ]);
  const nodeNames = new Map(nodes.map((node) => [node.id, node.display_name || node.name]));
  const domainNames = new Map(domains.map((domain) => [domain.id, domain.name]));
  return services.map((service) =>
    mapService({
      ...service,
      node_name: service.node_id ? nodeNames.get(service.node_id) : undefined,
      domain_name: service.domain_id ? domainNames.get(service.domain_id) : undefined,
    }),
  );
}

export async function addService(input: ServiceWriteInput): Promise<Service> {
  if (MOCK_MODE) {
    throw new ApiError('Mock mode does not support service creation', 'MOCK_READONLY', 400);
  }
  const created = await request<HalocService>('/services', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return mapService(created);
}

export async function deleteService(id: string): Promise<void> {
  if (MOCK_MODE) {
    throw new ApiError('Mock mode does not support service deletion', 'MOCK_READONLY', 400);
  }
  await request<void>(`/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function checkService(id: string): Promise<void> {
  if (MOCK_MODE) return delay(undefined);
  await request<unknown>(`/services/${encodeURIComponent(id)}/check`, { method: 'POST' });
}
