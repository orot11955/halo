import type { Runbook } from '@/types/runbook';

const day = (n: number) => new Date(Date.now() - n * 86400 * 1000).toISOString();

export const mockRunbooks: Runbook[] = [
  {
    id: 'rb-power-loss',
    title: 'Power loss recovery',
    summary: 'Bring the home rack back online after grid outage longer than UPS runtime.',
    tags: ['ups', 'orbit', 'kepler', 'voyager'],
    status: 'verified',
    scope: 'global',
    updated_at: day(12),
    last_run_at: day(45),
    steps: [
      { title: 'Verify UPS state', body: 'Connect to NUT (`upsc cyberpower`) and check Status / Battery Charge before powering on.' },
      { title: 'Power on Orbit first', body: 'Wait for halon agent heartbeat in the dashboard before starting other nodes.' },
      { title: 'Bring Kepler online', body: 'Once Orbit is healthy, power Kepler. Wait for ZFS pool import to finish.' },
      { title: 'Verify edge proxy', body: 'Check traefik certificate validity and that orot.dev returns 200.' },
    ],
  },
  {
    id: 'rb-cert-renewal',
    title: 'Manual SSL renewal',
    summary: 'Force a Let\'s Encrypt renewal when traefik can\'t reach the ACME challenge.',
    tags: ['ssl', 'traefik', 'orbit'],
    status: 'verified',
    scope: 'service:traefik',
    updated_at: day(28),
    last_run_at: day(28),
    steps: [
      { title: 'Pause UFW DNAT to 80', body: 'sudo ufw delete allow 80; verify external probe fails.' },
      { title: 'Run traefik --renew-only', body: 'Use the operator container so state lives outside the prod volume.' },
      { title: 'Restore firewall', body: 'sudo ufw allow 80; check certificate fingerprint changed.' },
    ],
  },
  {
    id: 'rb-disk-pressure',
    title: 'Disk pressure on Kepler pool',
    summary: 'Drain space when /tank is over 85%.',
    tags: ['disk', 'kepler', 'jellyfin'],
    status: 'draft',
    scope: 'node:kepler',
    updated_at: day(2),
    steps: [
      { title: 'Identify largest snapshots', body: 'zfs list -t snapshot -o name,used -s used | tail -20' },
      { title: 'Prune Jellyfin transcodes', body: 'Stop jellyfin container, rm /transcodes/*, restart.' },
      { title: 'Trigger photo dedup', body: 'Run dedup script described in cloud-runbook §3.' },
    ],
  },
  {
    id: 'rb-ssh-lockout',
    title: 'Locked out of SSH',
    summary: 'Recover access when public-key auth is broken on a node.',
    tags: ['security', 'ssh'],
    status: 'stale',
    scope: 'global',
    updated_at: day(120),
    steps: [
      { title: 'Use IPMI / KVM', body: 'Plug into Orbit BMC for serial console.' },
      { title: 'Mount root read-write', body: 'mount -o remount,rw /' },
      { title: 'Restore authorized_keys', body: 'cp /root/.halo/authorized_keys.bak ~/.ssh/authorized_keys' },
    ],
  },
];
