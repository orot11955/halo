export type AssetKind =
  | 'internet'
  | 'router'
  | 'switch'
  | 'access_point'
  | 'server'
  | 'nas'
  | 'desktop'
  | 'laptop'
  | 'lxc'
  | 'vm'
  | 'docker_host'
  | 'ups'
  | 'external_disk'
  | 'camera'
  | 'monitor'
  | 'patch_panel'
  | 'kvm';

export type AssetStatus = 'ok' | 'warning' | 'offline' | 'unknown';

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  description?: string;
  ip?: string;
  mac?: string;
  vendor?: string;
  model?: string;
  location?: string;
  note?: string;
  linked_node?: string;
  status: AssetStatus;
  position?: { x: number; y: number };
}

export interface CreateAssetInput {
  kind: AssetKind;
  name: string;
  ip?: string;
  mac?: string;
  vendor?: string;
  model?: string;
  location?: string;
  note?: string;
  linked_node?: string;
}

export interface CreateConnectionInput {
  from: string;
  to: string;
  kind?: AssetConnection['kind'];
  label?: string;
  port?: string;
}

export interface AssetConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  port?: string;
  kind?: 'ethernet' | 'wifi' | 'fiber' | 'usb' | 'power';
}

export interface TopologyGraph {
  assets: Asset[];
  connections: AssetConnection[];
}

export interface ImpactItem {
  asset_id: string;
  asset_name: string;
  affected_services: string[];
  affected_domains: string[];
  affected_nodes: string[];
}
