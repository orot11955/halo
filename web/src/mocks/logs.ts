import type { LogLine, LogSource } from '@/types/log';

export const mockLogSources: LogSource[] = [
  { id: 'src-orbit-traefik', node: 'orbit', name: 'traefik', kind: 'docker', target: 'traefik', linked_service: 'traefik', description: 'Edge proxy access log' },
  { id: 'src-orbit-postgres', node: 'orbit', name: 'postgres', kind: 'docker', target: 'postgres-main', linked_service: 'postgres' },
  { id: 'src-orbit-sshd', node: 'orbit', name: 'sshd', kind: 'systemd', target: 'sshd.service' },
  { id: 'src-orbit-halon', node: 'orbit', name: 'halon', kind: 'systemd', target: 'halon.service', description: 'halon agent journal' },
  { id: 'src-kepler-jellyfin', node: 'kepler', name: 'jellyfin', kind: 'docker', target: 'jellyfin', linked_service: 'jellyfin' },
  { id: 'src-kepler-nfs', node: 'kepler', name: 'nfs', kind: 'systemd', target: 'nfs-server.service' },
  { id: 'src-voyager-hass', node: 'voyager', name: 'home-assistant', kind: 'docker', target: 'home-assistant', linked_service: 'home-assistant' },
];

const now = Date.now();
function ago(seconds: number) {
  return new Date(now - seconds * 1000).toISOString();
}

export const mockLogTail: Record<string, LogLine[]> = {
  'src-orbit-traefik': [
    { ts: ago(5), level: 'info', message: '192.0.2.10 GET / 200 12ms', source_id: 'src-orbit-traefik' },
    { ts: ago(8), level: 'info', message: '192.0.2.10 GET /api/v1/dashboard 200 38ms', source_id: 'src-orbit-traefik' },
    { ts: ago(40), level: 'warning', message: 'router orot-api: backend connection reset', source_id: 'src-orbit-traefik' },
    { ts: ago(120), level: 'info', message: 'cert renewal scheduled in 23 days for orot.dev', source_id: 'src-orbit-traefik' },
  ],
  'src-orbit-postgres': [
    { ts: ago(20), level: 'info', message: 'checkpoint complete: wrote 1402 buffers (8.6%)', source_id: 'src-orbit-postgres' },
    { ts: ago(180), level: 'warning', message: 'autovacuum: long lock on table public.events_2026_05', source_id: 'src-orbit-postgres' },
  ],
  'src-orbit-sshd': [
    { ts: ago(95), level: 'notice', message: 'Accepted publickey for orot from 192.168.1.4 port 51420', source_id: 'src-orbit-sshd' },
    { ts: ago(840), level: 'warning', message: 'Failed password for invalid user admin from 203.0.113.12', source_id: 'src-orbit-sshd' },
  ],
  'src-orbit-halon': [
    { ts: ago(2), level: 'debug', message: 'pushed metrics sample step=15s', source_id: 'src-orbit-halon' },
    { ts: ago(60), level: 'info', message: 'reconnected to haloc stream', source_id: 'src-orbit-halon' },
  ],
  'src-kepler-jellyfin': [
    { ts: ago(15), level: 'info', message: 'User "orot" started playback of "Dune Part Two"', source_id: 'src-kepler-jellyfin' },
    { ts: ago(220), level: 'info', message: 'Library scan completed in 04:12', source_id: 'src-kepler-jellyfin' },
  ],
  'src-kepler-nfs': [
    { ts: ago(310), level: 'info', message: 'rpc.mountd: authenticated mount request from 192.168.1.10:756 for /export/media', source_id: 'src-kepler-nfs' },
  ],
  'src-voyager-hass': [
    { ts: ago(65), level: 'info', message: 'state changed: light.living_room -> on', source_id: 'src-voyager-hass' },
    { ts: ago(430), level: 'error', message: 'integration zwave-js setup failed: connection refused', source_id: 'src-voyager-hass' },
  ],
};
