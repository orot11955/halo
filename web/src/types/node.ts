import type { Status } from './api';

export interface Node {
  name: string;
  display_name: string;
  hostname: string;
  status: Status;
  url?: string;
  os: string;
  arch: string;
  ip: string;
  version: string;
  uptime_seconds: number;
  cpu_used_percent: number;
  memory_used_percent: number;
  disk_used_percent: number;
  last_seen_at: string;
  error_message?: string;
  has_token?: boolean;
}
