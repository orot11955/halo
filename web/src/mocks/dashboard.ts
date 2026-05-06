import type { DashboardSummary } from '@/types/dashboard';
import { mockNodes } from './nodes';
import { mockServices } from './services';
import { mockDomains } from './domains';
import { mockEvents } from './events';

export function buildMockDashboard(): DashboardSummary {
  const onlineCount = mockNodes.filter((n) => n.status === 'online').length;
  const offlineCount = mockNodes.filter((n) => n.status === 'offline').length;
  const warningCount = mockNodes.filter((n) => n.status === 'warning').length;

  const healthy = mockServices.filter((s) => s.health === 'healthy').length;
  const warn = mockServices.filter((s) => s.health === 'warning').length;
  const unknown = mockServices.filter((s) => s.health === 'unknown').length;

  const sslWarn = mockDomains.filter(
    (d) => (d.days_remaining ?? 365) <= 14 || d.status !== 'ok',
  ).length;

  const cpuAvg =
    mockNodes.reduce((acc, n) => acc + n.cpu_used_percent, 0) / Math.max(1, mockNodes.length);
  const memAvg =
    mockNodes.reduce((acc, n) => acc + n.memory_used_percent, 0) / Math.max(1, mockNodes.length);
  const diskMax = mockNodes.reduce((acc, n) => Math.max(acc, n.disk_used_percent), 0);

  return {
    nodes: {
      total: mockNodes.length,
      online: onlineCount,
      offline: offlineCount,
      warning: warningCount,
    },
    services: {
      total: mockServices.length,
      healthy,
      warning: warn,
      unknown,
    },
    domains: {
      total: mockDomains.length,
      ssl_warning: sslWarn,
    },
    resources: {
      cpu_used_percent_avg: +cpuAvg.toFixed(1),
      memory_used_percent_avg: +memAvg.toFixed(1),
      disk_used_percent_max: +diskMax.toFixed(1),
    },
    events: {
      unresolved: mockEvents.filter((e) => !e.resolved).length,
      recent: [...mockEvents].slice(0, 5),
    },
  };
}
