export type ContainerState = 'running' | 'restarting' | 'exited' | 'paused' | 'created';

export interface Container {
  id: string;
  name: string;
  image: string;
  state: ContainerState;
  status: string;
  uptime_seconds?: number;
  restart_count: number;
  ports: string[];
  cpu_percent?: number;
  memory_used_bytes?: number;
  memory_limit_bytes?: number;
  compose_project?: string;
  linked_service?: string;
  node: string;
}
