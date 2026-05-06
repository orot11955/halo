import type { Asset, AssetConnection, ImpactItem, TopologyGraph } from '@/types/topology';

const ASSETS: Asset[] = [
  { id: 'a-internet', kind: 'internet', name: 'Internet', status: 'ok', position: { x: 360, y: 40 } },
  { id: 'a-router', kind: 'router', name: 'Edge Router', ip: '192.168.1.1', status: 'ok', position: { x: 360, y: 130 } },
  { id: 'a-switch', kind: 'switch', name: '24-port Switch', ip: '192.168.1.2', status: 'ok', position: { x: 360, y: 230 } },
  { id: 'a-ap', kind: 'access_point', name: 'Wi-Fi 6 AP', ip: '192.168.1.3', status: 'ok', position: { x: 580, y: 230 } },
  { id: 'a-orbit', kind: 'server', name: 'Orbit', ip: '192.168.1.10', linked_node: 'orbit', status: 'ok', position: { x: 160, y: 340 } },
  { id: 'a-kepler', kind: 'nas', name: 'Kepler', ip: '192.168.1.11', linked_node: 'kepler', status: 'ok', position: { x: 360, y: 340 } },
  { id: 'a-voyager', kind: 'lxc', name: 'Voyager', ip: '192.168.1.12', linked_node: 'voyager', status: 'ok', position: { x: 560, y: 340 } },
  { id: 'a-pluto', kind: 'desktop', name: 'Pluto (workstation)', ip: '192.168.1.20', status: 'unknown', position: { x: 720, y: 340 } },
  { id: 'a-ups', kind: 'ups', name: 'CyberPower UPS', status: 'ok', position: { x: 60, y: 240 } },
  { id: 'a-disk', kind: 'external_disk', name: 'Cold backup HDD', status: 'offline', position: { x: 60, y: 340 } },
];

const CONNECTIONS: AssetConnection[] = [
  { id: 'c-1', from: 'a-internet', to: 'a-router', kind: 'fiber', label: 'WAN' },
  { id: 'c-2', from: 'a-router', to: 'a-switch', kind: 'ethernet' },
  { id: 'c-3', from: 'a-switch', to: 'a-ap', kind: 'ethernet', port: 'p1' },
  { id: 'c-4', from: 'a-switch', to: 'a-orbit', kind: 'ethernet', port: 'p4' },
  { id: 'c-5', from: 'a-switch', to: 'a-kepler', kind: 'ethernet', port: 'p5' },
  { id: 'c-6', from: 'a-switch', to: 'a-voyager', kind: 'ethernet', port: 'p6' },
  { id: 'c-7', from: 'a-ap', to: 'a-pluto', kind: 'wifi' },
  { id: 'c-8', from: 'a-ups', to: 'a-orbit', kind: 'power' },
  { id: 'c-9', from: 'a-orbit', to: 'a-disk', kind: 'usb' },
];

export const mockTopology: TopologyGraph = { assets: ASSETS, connections: CONNECTIONS };

export const mockImpact: ImpactItem[] = [
  {
    asset_id: 'a-router',
    asset_name: 'Edge Router',
    affected_services: ['traefik', 'home-assistant', 'jellyfin', 'nextcloud', 'grafana'],
    affected_domains: ['orot.dev', 'cloud.orot.dev', 'media.orot.dev'],
    affected_nodes: ['orbit', 'kepler', 'voyager'],
  },
  {
    asset_id: 'a-switch',
    asset_name: '24-port Switch',
    affected_services: ['traefik', 'jellyfin', 'nextcloud', 'home-assistant'],
    affected_domains: ['orot.dev', 'cloud.orot.dev', 'media.orot.dev'],
    affected_nodes: ['orbit', 'kepler', 'voyager'],
  },
  {
    asset_id: 'a-orbit',
    asset_name: 'Orbit',
    affected_services: ['traefik', 'grafana', 'prometheus', 'postgres'],
    affected_domains: ['orot.dev', 'metrics.orot.dev'],
    affected_nodes: ['orbit'],
  },
  {
    asset_id: 'a-kepler',
    asset_name: 'Kepler',
    affected_services: ['jellyfin', 'nextcloud'],
    affected_domains: ['cloud.orot.dev', 'media.orot.dev'],
    affected_nodes: ['kepler'],
  },
  {
    asset_id: 'a-ups',
    asset_name: 'CyberPower UPS',
    affected_services: ['traefik', 'grafana', 'prometheus', 'postgres'],
    affected_domains: ['orot.dev', 'metrics.orot.dev'],
    affected_nodes: ['orbit'],
  },
];
