import type { HaloEvent } from './event';

export interface DashboardSummary {
  nodes: {
    total: number;
    online: number;
    offline: number;
    warning: number;
  };
  services: {
    total: number;
    healthy: number;
    warning: number;
    unknown: number;
  };
  domains: {
    total: number;
    ssl_warning: number;
  };
  resources: {
    cpu_used_percent_avg: number;
    memory_used_percent_avg: number;
    disk_used_percent_max: number;
  };
  events: {
    unresolved: number;
    recent: HaloEvent[];
  };
}
