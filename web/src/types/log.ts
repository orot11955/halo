export type LogSourceKind = 'systemd' | 'journal' | 'docker' | 'file';
export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical';

export interface LogSource {
  id: string;
  node: string;
  name: string;
  kind: LogSourceKind;
  target: string;
  linked_service?: string;
  description?: string;
}

export interface LogLine {
  ts: string;
  level: LogLevel;
  message: string;
  source_id: string;
}
