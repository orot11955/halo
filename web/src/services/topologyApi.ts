import { delay, MOCK_MODE, request } from './apiClient';
import { mockTopology, mockImpact } from '@/mocks/topology';
import type {
  Asset,
  AssetConnection,
  CreateAssetInput,
  CreateConnectionInput,
  ImpactItem,
  TopologyGraph,
} from '@/types/topology';

export async function getTopology(): Promise<TopologyGraph> {
  if (MOCK_MODE) return delay(mockTopology);
  return request<TopologyGraph>('/topology/graph');
}

export async function listAssets(): Promise<Asset[]> {
  if (MOCK_MODE) return delay(mockTopology.assets);
  return request<Asset[]>('/topology/assets');
}

export async function listImpact(): Promise<ImpactItem[]> {
  if (MOCK_MODE) return delay(mockImpact);
  return request<ImpactItem[]>('/topology/impact');
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  if (MOCK_MODE) {
    const created: Asset = {
      ...input,
      id: `asset-${Date.now().toString(36)}`,
      status: 'unknown',
    };
    mockTopology.assets.push(created);
    return delay(created);
  }
  return request<Asset>('/topology/assets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAssetPosition(id: string, x: number, y: number): Promise<Asset> {
  if (MOCK_MODE) {
    const asset = mockTopology.assets.find((a) => a.id === id);
    if (asset) asset.position = { x, y };
    return delay(asset ?? ({ id, kind: 'server', name: id, status: 'unknown' } as Asset));
  }
  return request<Asset>(`/topology/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ position: { x, y } }),
  });
}

export async function deleteAsset(id: string): Promise<void> {
  if (MOCK_MODE) {
    const idx = mockTopology.assets.findIndex((a) => a.id === id);
    if (idx >= 0) mockTopology.assets.splice(idx, 1);
    mockTopology.connections = mockTopology.connections.filter(
      (c) => c.from !== id && c.to !== id,
    );
    return delay(undefined);
  }
  await request<void>(`/topology/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createConnection(input: CreateConnectionInput): Promise<AssetConnection> {
  if (MOCK_MODE) {
    const created: AssetConnection = {
      ...input,
      id: `conn-${Date.now().toString(36)}`,
    };
    mockTopology.connections.push(created);
    return delay(created);
  }
  return request<AssetConnection>('/topology/connections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
