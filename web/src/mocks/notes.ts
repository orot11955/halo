import type { Note } from '@/types/note';

const day = (n: number) => new Date(Date.now() - n * 86400 * 1000).toISOString();

export const mockNotes: Note[] = [
  {
    id: 'n-orbit-1',
    scope: 'node',
    scope_ref: 'orbit',
    title: 'NVMe slot 0 making intermittent click',
    body:
      'Schedule replacement before next quarter. Backup pool already mirrored to kepler. SMART attribute 197 trending up since 2026-04-12.',
    pinned: true,
    updated_at: day(3),
  },
  {
    id: 'n-orbit-2',
    scope: 'node',
    scope_ref: 'orbit',
    title: 'UPS auto-shutdown threshold',
    body:
      'NUT configured to gracefully shutdown at 8% battery. Verified during 2026-04-22 power test.',
    pinned: false,
    updated_at: day(11),
  },
  {
    id: 'n-kepler-1',
    scope: 'node',
    scope_ref: 'kepler',
    title: 'TrueNAS upgrade window',
    body: 'Defer 24.10 -> 25.04 upgrade until Jellyfin 10.10 confirmed compatible.',
    pinned: false,
    updated_at: day(6),
  },
  {
    id: 'n-voyager-1',
    scope: 'node',
    scope_ref: 'voyager',
    title: 'Z-Wave dongle quirks',
    body: 'After power loss the Aeotec Z-Stick 7 takes ~90 seconds to re-enumerate. Wait before restarting Home Assistant.',
    pinned: true,
    updated_at: day(18),
  },
];
