import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { Field, Checkbox, TextArea, TextInput } from '@/components/ui/Field';
import { useAddNote, useDeleteNote, useNotes } from '@/hooks/useNotes';
import { useConfirmDelete, useMutationToast } from '@/hooks/useDeleteAction';
import { timeAgo } from '@/utils/date';
import { useT } from '@/i18n';
import styles from './NodeNotes.module.css';

export function NodeNotes({ name }: { name: string }) {
  const t = useT();
  const query = useNotes('node', name);
  const del = useDeleteNote();
  const confirmDelete = useConfirmDelete();
  const toast = useMutationToast();
  const [open, setOpen] = useState(false);

  const onDelete = async (id: string, title: string) => {
    const ok = await confirmDelete({
      title: t('common.delete'),
      description: t('notes.confirm.delete'),
    });
    if (!ok) return;
    try {
      await del.mutateAsync(id);
      toast.success(t('common.deleted'), title);
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card
      title={t('notes.title')}
      subtitle={t('notes.subtitle')}
      actions={
        <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
          <Icon name="plus" size={12} />
          {t('notes.action.new')}
        </Button>
      }
    >
      <NoteFormModal open={open} onClose={() => setOpen(false)} nodeName={name} />
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('notes.empty.title')}
        emptyDetail={t('notes.empty.detail')}
      >
        {(notes) => {
          const sorted = [...notes].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });
          return (
            <div className={styles.list}>
              {sorted.map((note) => {
                const isSynthetic = note.id.startsWith('node-') && note.id.endsWith('-last-error');
                return (
                  <article key={note.id} className={styles.note}>
                    <header className={styles.head}>
                      <div className={styles.title}>
                        {note.pinned && (
                          <span className={styles.pinIcon} aria-label={t('notes.pinned')}>
                            <Icon name="shield" size={12} />
                          </span>
                        )}
                        {note.title}
                      </div>
                      <div className={styles.meta}>
                        {note.pinned && (
                          <StatusBadge tone="info" dot>
                            {t('notes.pinned')}
                          </StatusBadge>
                        )}
                        <span className={styles.metaTime}>
                          {t('notes.updated', { time: timeAgo(note.updated_at) })}
                        </span>
                        {!isSynthetic && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(note.id, note.title)}
                            disabled={del.isPending}
                            aria-label={t('common.delete')}
                          >
                            <Icon name="x" size={12} />
                          </Button>
                        )}
                      </div>
                    </header>
                    <p className={styles.body}>{note.body}</p>
                  </article>
                );
              })}
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}

function NoteFormModal({
  open,
  onClose,
  nodeName,
}: {
  open: boolean;
  onClose: () => void;
  nodeName: string;
}) {
  const t = useT();
  const add = useAddNote();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);

  const close = () => {
    if (add.isPending) return;
    add.reset();
    setTitle('');
    setBody('');
    setPinned(false);
    onClose();
  };

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await add.mutateAsync({
        scope: 'node',
        scope_ref: nodeName,
        title: title.trim(),
        body: body.trim(),
        pinned,
      });
      close();
    } catch {
      /* surfaced */
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      busy={add.isPending}
      title={t('notes.action.new')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={add.isPending || !title.trim()}>
            {add.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      {add.isError && (
        <ModalErrorBanner>{(add.error as Error)?.message ?? t('common.error')}</ModalErrorBanner>
      )}
      <Field label={t('notes.form.title')} required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label={t('notes.form.body')}>
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
      </Field>
      <Checkbox checked={pinned} onChange={setPinned}>
        {t('notes.form.pinned')}
      </Checkbox>
    </Modal>
  );
}
