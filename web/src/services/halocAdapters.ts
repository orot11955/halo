import type { DashboardSummary } from '@/types/dashboard';
import type { Domain } from '@/types/domain';
import type { HaloEvent } from '@/types/event';
import type { MetricPoint, MetricsHistory } from '@/types/metrics';
import type { Node } from '@/types/node';
import type { Service } from '@/types/service';
import type { Health, Severity, Status } from '@/types/api';

export interface HalocOverview {
  nodes: { total: number; online: number; offline: number };
  services: { total: number; healthy: number; warning: number; unknown: number };
  domains: { total: number; ssl_warning: number };
  events: { unresolved: number };
}

export interface HalocDashboard {
  overview: HalocOverview;
  nodes: HalocNode[];
  recent_events: HalocEvent[];
  domain_warnings: { name: string; message: string }[];
}

export interface HalocNode {
  id: number;
  name: string;
  display_name: string;
  role: string;
  url: string;
  ip_address: string;
  status: string;
  hostname: string;
  os: string;
  arch: string;
  version: string;
  enabled: boolean;
  has_token?: boolean;
  current_metrics?: HalocMetricCurrent;
  created_at: string;
  updated_at: string;
  last_seen_at?: string;
  error_message?: string;
}

export interface HalocNodeSummary {
  node: HalocNode;
  current_metrics?: HalocMetricCurrent;
}

export interface HalocMetricCurrent {
  node: string;
  collected_at: string;
  cpu_used_percent: number;
  memory_used_percent: number;
  disk_root_used_percent: number;
  network_rx_bytes_total: number;
  network_tx_bytes_total: number;
  cpu_load_1?: number;
  cpu_load_5?: number;
  cpu_load_15?: number;
}

export interface HalocMetricHistory {
  node: string;
  range: string;
  step: string;
  points: HalocMetricCurrent[];
}

export interface HalocService {
  id: number;
  name: string;
  node_id?: number;
  node_name?: string;
  kind: string;
  port?: number;
  domain_id?: number;
  domain_name?: string;
  health_check_url: string;
  health_status: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface HalocDomain {
  id: number;
  name: string;
  service_id?: number;
  service_name?: string;
  expected_ip: string;
  dns?: {
    resolved_ips?: string[];
    expected_ip_match?: boolean;
    error_message?: string;
  };
  http?: {
    http_status?: number;
    https_status?: number;
    http_response_time_ms?: number;
    https_response_time_ms?: number;
    error_message?: string;
  };
  ssl?: {
    issuer?: string;
    subject?: string;
    expires_at?: string;
    days_remaining?: number;
    warning?: boolean;
    critical?: boolean;
    error_message?: string;
  };
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface HalocEvent {
  id: number;
  level: string;
  type: string;
  source_type: string;
  source_id: string;
  message: string;
  created_at: string;
  resolved_at?: string;
}

export function mapNode(node: HalocNode, metrics?: HalocMetricCurrent): Node {
  const status = isStatus(node.status) ? node.status : 'unknown';
  const current = metrics ?? node.current_metrics;
  return {
    name: node.name,
    display_name: node.display_name || node.name,
    hostname: node.hostname || node.name,
    status,
    url: node.url,
    os: node.os || 'unknown',
    arch: node.arch || 'unknown',
    ip: node.ip_address || '—',
    version: node.version || '—',
    uptime_seconds: 0,
    cpu_used_percent: current?.cpu_used_percent ?? 0,
    memory_used_percent: current?.memory_used_percent ?? 0,
    disk_used_percent: current?.disk_root_used_percent ?? 0,
    last_seen_at: node.last_seen_at ?? node.updated_at ?? node.created_at,
    error_message: node.error_message,
    has_token: node.has_token,
  };
}

export function mapDashboard(dashboard: HalocDashboard, nodes: HalocNode[]): DashboardSummary {
  const mappedNodes = nodes.map((node) => mapNode(node));
  const resources = {
    cpu_used_percent_avg: avg(mappedNodes.map((node) => node.cpu_used_percent)),
    memory_used_percent_avg: avg(mappedNodes.map((node) => node.memory_used_percent)),
    disk_used_percent_max: max(mappedNodes.map((node) => node.disk_used_percent)),
  };
  return {
    nodes: {
      total: dashboard.overview.nodes.total,
      online: dashboard.overview.nodes.online,
      offline: dashboard.overview.nodes.offline,
      warning: Math.max(
        0,
        dashboard.overview.nodes.total -
          dashboard.overview.nodes.online -
          dashboard.overview.nodes.offline,
      ),
    },
    services: dashboard.overview.services,
    domains: dashboard.overview.domains,
    resources,
    events: {
      unresolved: dashboard.overview.events.unresolved,
      recent: dashboard.recent_events.map(mapEvent),
    },
  };
}

export function mapService(service: HalocService): Service {
  return {
    id: String(service.id),
    name: service.name,
    node: service.node_name ?? (service.node_id ? `#${service.node_id}` : '—'),
    kind: service.kind || 'custom',
    port: service.port,
    domain: service.domain_name ?? (service.domain_id ? `#${service.domain_id}` : undefined),
    health: isHealth(service.health_status) ? service.health_status : 'unknown',
    health_check_url: service.health_check_url,
    last_checked_at: service.updated_at || service.created_at,
    description: service.note,
  };
}

export function mapDomain(domain: HalocDomain): Domain {
  const resolvedIPs = domain.dns?.resolved_ips ?? [];
  const ssl = domain.ssl ?? {};
  const http = domain.http ?? {};
  const error =
    ssl.error_message || http.error_message || domain.dns?.error_message || undefined;
  const dnsMismatch = domain.dns?.expected_ip_match === false;
  const status = ssl.critical || error ? 'error' : ssl.warning || dnsMismatch ? 'warning' : 'ok';

  return {
    domain: domain.name,
    dns_a: resolvedIPs,
    resolved_ips: resolvedIPs,
    expected_ip: domain.expected_ip,
    http_status: http.http_status,
    https_status: http.https_status,
    response_time_ms: http.https_response_time_ms ?? http.http_response_time_ms,
    ssl_issuer: ssl.issuer,
    ssl_subject: ssl.subject,
    ssl_expires_at: ssl.expires_at,
    days_remaining: ssl.days_remaining,
    linked_service: domain.service_name ?? (domain.service_id ? `#${domain.service_id}` : undefined),
    status,
    error_message: error,
    last_checked_at: domain.last_checked_at ?? domain.updated_at ?? domain.created_at,
  };
}

export function mapEvent(event: HalocEvent): HaloEvent {
  return {
    id: String(event.id),
    kind: event.type,
    severity: isSeverity(event.level) ? event.level : 'info',
    source: event.source_type,
    subject: event.source_id || event.source_type,
    message: event.message,
    resolved: Boolean(event.resolved_at),
    occurred_at: event.created_at,
  };
}

export function mapMetricsHistory(history: HalocMetricHistory): MetricsHistory {
  return {
    node: history.node,
    range: history.range as MetricsHistory['range'],
    step: history.step,
    points: history.points.map(mapMetricPoint),
  };
}

function mapMetricPoint(point: HalocMetricCurrent): MetricPoint {
  return {
    time: point.collected_at,
    cpu_load_1: point.cpu_load_1 ?? 0,
    cpu_load_5: point.cpu_load_5 ?? 0,
    cpu_load_15: point.cpu_load_15 ?? 0,
    cpu_used_percent: point.cpu_used_percent ?? 0,
    memory_used_percent: point.memory_used_percent ?? 0,
    disk_root_used_percent: point.disk_root_used_percent ?? 0,
    network_rx_bytes_total: point.network_rx_bytes_total ?? 0,
    network_tx_bytes_total: point.network_tx_bytes_total ?? 0,
  };
}

function isStatus(value: string): value is Status {
  return ['online', 'offline', 'warning', 'unknown'].includes(value);
}

function isHealth(value: string): value is Health {
  return ['healthy', 'warning', 'critical', 'unknown'].includes(value);
}

function isSeverity(value: string): value is Severity {
  return ['info', 'warning', 'critical'].includes(value);
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function max(values: number[]): number {
  if (!values.length) return 0;
  return Number(Math.max(...values).toFixed(1));
}
