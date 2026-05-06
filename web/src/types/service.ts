import type { Health } from './api';

export type ServiceKind = string;

export interface Service {
  id: string;
  name: string;
  node: string;
  kind: ServiceKind;
  port?: number;
  domain?: string;
  health: Health;
  health_check_url?: string;
  last_checked_at: string;
  description?: string;
}
