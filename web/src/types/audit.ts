export type AuditAction =
  | 'token.issued'
  | 'token.revoked'
  | 'service.registered'
  | 'service.deleted'
  | 'domain.added'
  | 'domain.removed'
  | 'node.enrolled'
  | 'log_source.added'
  | 'maintenance.start'
  | 'maintenance.end';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actor: string;
  target: string;
  detail?: string;
  ts: string;
}

export type MaintenanceState = 'scheduled' | 'active' | 'completed';

export interface MaintenanceWindow {
  id: string;
  title: string;
  scope: string;
  state: MaintenanceState;
  starts_at: string;
  ends_at: string;
  note?: string;
}
