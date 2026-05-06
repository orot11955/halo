export type RunbookStatus = 'draft' | 'verified' | 'stale';

export interface RunbookStep {
  title: string;
  body: string;
}

export interface Runbook {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  status: RunbookStatus;
  scope?: string;
  updated_at: string;
  last_run_at?: string;
  steps: RunbookStep[];
}
