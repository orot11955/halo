import type { Severity } from './api';

export type EventKind =
  | 'node.online'
  | 'node.offline'
  | 'node.warning'
  | 'service.warning'
  | 'service.healthy'
  | 'domain.warning'
  | 'disk.warning'
  | 'ssl.expiry.warning'
  | 'domain.check.failed'
  | 'alert.created'
  | 'alert.resolved'
  | string;

export interface HaloEvent {
  id: string;
  kind: EventKind;
  severity: Severity;
  source: string;
  subject: string;
  message: string;
  resolved: boolean;
  occurred_at: string;
}
