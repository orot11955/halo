import { delay, MOCK_MODE, request } from './apiClient';
import { mockNotes } from '@/mocks/notes';
import type { Note, NoteScope } from '@/types/note';

export interface AddNoteInput {
  scope: NoteScope;
  scope_ref?: string;
  title: string;
  body?: string;
  pinned?: boolean;
}

export async function listNotes(scope?: string, scopeRef?: string): Promise<Note[]> {
  if (MOCK_MODE) {
    let rows = mockNotes;
    if (scope) rows = rows.filter((n) => n.scope === scope);
    if (scopeRef) rows = rows.filter((n) => n.scope_ref === scopeRef);
    return delay(rows);
  }
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  if (scopeRef) params.set('scope_ref', scopeRef);
  const qs = params.toString();
  return request<Note[]>(`/notes${qs ? `?${qs}` : ''}`);
}

export async function addNote(input: AddNoteInput): Promise<Note> {
  if (MOCK_MODE) {
    const created: Note = {
      id: `note-${Date.now()}`,
      scope: input.scope,
      scope_ref: input.scope_ref ?? '',
      title: input.title,
      body: input.body ?? '',
      pinned: Boolean(input.pinned),
      updated_at: new Date().toISOString(),
    };
    mockNotes.unshift(created);
    return delay(created);
  }
  return request<Note>('/notes', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteNote(id: string): Promise<void> {
  if (MOCK_MODE) {
    const idx = mockNotes.findIndex((n) => n.id === id);
    if (idx >= 0) mockNotes.splice(idx, 1);
    return delay(undefined);
  }
  await request<void>(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
