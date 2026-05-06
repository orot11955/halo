import type { AuditEntry, MaintenanceWindow } from '@/types/audit';

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
const fromNow = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();

export const mockAuditLog: AuditEntry[] = [
  { id: 'a-1', action: 'token.issued', actor: 'orot', target: 'voyager-agent', detail: 'scope=node.read', ts: ago(60 * 4) },
  { id: 'a-2', action: 'service.registered', actor: 'orot', target: 'service:home-assistant', ts: ago(60 * 24) },
  { id: 'a-3', action: 'log_source.added', actor: 'orot', target: 'src-voyager-hass', detail: 'docker:home-assistant', ts: ago(60 * 26) },
  { id: 'a-4', action: 'domain.added', actor: 'orot', target: 'media.orot.dev', ts: ago(60 * 33) },
  { id: 'a-5', action: 'maintenance.start', actor: 'orot', target: 'kepler', detail: 'TrueNAS update window', ts: ago(60 * 73) },
  { id: 'a-6', action: 'maintenance.end', actor: 'system', target: 'kepler', detail: 'auto-resolved', ts: ago(60 * 71) },
  { id: 'a-7', action: 'token.revoked', actor: 'orot', target: 'legacy-bot', ts: ago(60 * 96) },
  { id: 'a-8', action: 'node.enrolled', actor: 'orot', target: 'voyager', detail: 'lxc on orbit', ts: ago(60 * 26 * 7) },
];

export const mockMaintenance: MaintenanceWindow[] = [
  {
    id: 'm-1',
    title: 'Quarterly storage upgrade',
    scope: 'kepler',
    state: 'scheduled',
    starts_at: fromNow(60 * 24 * 6),
    ends_at: fromNow(60 * 24 * 6 + 90),
    note: 'Add 8TB drive to tank pool. Expect ~30 min IO pause during resilver.',
  },
  {
    id: 'm-2',
    title: 'Edge router firmware',
    scope: 'topology:a-router',
    state: 'scheduled',
    starts_at: fromNow(60 * 24 * 13),
    ends_at: fromNow(60 * 24 * 13 + 30),
    note: 'OPNsense 24.7 → 24.10',
  },
  {
    id: 'm-3',
    title: 'Cert auth rotation',
    scope: 'orbit',
    state: 'completed',
    starts_at: ago(60 * 24 * 4),
    ends_at: ago(60 * 24 * 4 - 25),
    note: 'Rotated mTLS root used by haloc <-> halon.',
  },
];
