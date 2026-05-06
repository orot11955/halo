import type { Status, Severity, Health } from '@/types/api';
import type { DomainStatus } from '@/types/domain';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function nodeStatusTone(status: Status): Tone {
  switch (status) {
    case 'online':
      return 'success';
    case 'warning':
      return 'warning';
    case 'offline':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function healthTone(health: Health): Tone {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function severityTone(severity: Severity): Tone {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

export function domainStatusTone(status: DomainStatus): Tone {
  switch (status) {
    case 'ok':
      return 'success';
    case 'warning':
      return 'warning';
    default:
      return 'danger';
  }
}

export function usageTone(percent: number): Tone {
  if (percent >= 85) return 'danger';
  if (percent >= 70) return 'warning';
  return 'success';
}
