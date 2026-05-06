export type NoteScope = 'node' | 'service' | 'domain' | 'global';

export interface Note {
  id: string;
  scope: NoteScope;
  scope_ref?: string;
  title: string;
  body: string;
  pinned: boolean;
  updated_at: string;
}
