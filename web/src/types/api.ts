export type Status = 'online' | 'offline' | 'warning' | 'unknown';
export type Severity = 'info' | 'warning' | 'critical';
export type Health = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface ApiError {
  code: string;
  message: string;
}
