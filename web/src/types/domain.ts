export type DomainStatus = 'ok' | 'warning' | 'error';

export interface Domain {
  domain: string;
  dns_a: string[];
  dns_aaaa?: string[];
  resolved_ips: string[];
  expected_ip?: string;
  http_status?: number;
  https_status?: number;
  response_time_ms?: number;
  redirect?: string;
  ssl_issuer?: string;
  ssl_subject?: string;
  ssl_expires_at?: string;
  days_remaining?: number;
  linked_service?: string;
  status: DomainStatus;
  error_message?: string;
  last_checked_at: string;
}
