import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addNote, deleteNote, listNotes } from '@/services/noteApi';
import type { NoteScope } from '@/types/note';

export function useNotes(scope?: NoteScope, scopeRef?: string) {
  return useQuery({
    queryKey: ['notes', scope ?? 'all', scopeRef ?? ''],
    queryFn: () => listNotes(scope, scopeRef),
  });
}

function useInvalidateNotes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['notes'] });
}

export function useAddNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({ mutationFn: addNote, onSuccess: invalidate });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({ mutationFn: deleteNote, onSuccess: invalidate });
}
