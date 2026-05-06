import type { NodePort } from '@/types/port';

interface NodePorts {
  node: string;
  ports: NodePort[];
}

export const mockPorts: NodePorts[] = [
  {
    node: 'orbit',
    ports: [
      { port: 22, protocol: 'tcp', bind_address: '0.0.0.0', process: 'sshd', pid: 712, visibility: 'public', registered: true, linked_service: 'sshd' },
      { port: 80, protocol: 'tcp', bind_address: '0.0.0.0', process: 'traefik', pid: 1804, visibility: 'public', registered: true, linked_service: 'traefik' },
      { port: 443, protocol: 'tcp', bind_address: '0.0.0.0', process: 'traefik', pid: 1804, visibility: 'public', registered: true, linked_service: 'traefik' },
      { port: 3000, protocol: 'tcp', bind_address: '127.0.0.1', process: 'grafana', pid: 2911, visibility: 'localhost', registered: true, linked_service: 'grafana' },
      { port: 5432, protocol: 'tcp', bind_address: '192.168.1.10', process: 'postgres', pid: 3007, visibility: 'private', registered: true, linked_service: 'postgres' },
      { port: 9090, protocol: 'tcp', bind_address: '127.0.0.1', process: 'prometheus', pid: 3122, visibility: 'localhost', registered: false },
      { port: 9100, protocol: 'tcp', bind_address: '0.0.0.0', process: 'node_exporter', pid: 3155, visibility: 'public', registered: false },
    ],
  },
  {
    node: 'kepler',
    ports: [
      { port: 22, protocol: 'tcp', bind_address: '0.0.0.0', process: 'sshd', pid: 502, visibility: 'public', registered: true },
      { port: 8096, protocol: 'tcp', bind_address: '0.0.0.0', process: 'jellyfin', pid: 1421, visibility: 'public', registered: true, linked_service: 'jellyfin' },
      { port: 8443, protocol: 'tcp', bind_address: '0.0.0.0', process: 'nextcloud', pid: 1612, visibility: 'public', registered: true, linked_service: 'nextcloud' },
      { port: 111, protocol: 'tcp', bind_address: '0.0.0.0', process: 'rpcbind', pid: 803, visibility: 'public', registered: false },
      { port: 2049, protocol: 'tcp', bind_address: '192.168.1.11', process: 'nfsd', visibility: 'private', registered: true },
    ],
  },
  {
    node: 'voyager',
    ports: [
      { port: 22, protocol: 'tcp', bind_address: '0.0.0.0', process: 'sshd', pid: 401, visibility: 'public', registered: true },
      { port: 8123, protocol: 'tcp', bind_address: '0.0.0.0', process: 'home-assistant', pid: 982, visibility: 'public', registered: true, linked_service: 'home-assistant' },
    ],
  },
];
