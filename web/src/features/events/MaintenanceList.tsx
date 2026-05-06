import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Toolbar, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { Field, FieldRow, TextArea, TextInput } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useAddMaintenance, useDeleteMaintenance, useMaintenance } from '@/hooks/useAudit';
import { useConfirmDelete, useMutationToast } from '@/hooks/useDeleteAction';
import { formatDateTime } from '@/utils/date';
import { useT } from '@/i18n';
import type { MaintenanceState, MaintenanceWindow } from '@/types/audit';

const STATE_TONE: Record<MaintenanceState, 'info' | 'warning' | 'success'> = {
  scheduled: 'info',
  active: 'warning',
  completed: 'success',
};

export function MaintenanceList() {
  const t = useT();
  const query = useMaintenance();
  const del = useDeleteMaintenance();
  const confirmDelete = useConfirmDelete();
  const toast = useMutationToast();
  const [newOpen, setNewOpen] = useState(false);

  const onDelete = async (m: MaintenanceWindow) => {
    const ok = await confirmDelete({
      title: t('common.delete'),
      description: t('maintenance.confirm.delete'),
    });
    if (!ok) return;
    try {
      await del.mutateAsync(m.id);
      toast.success(t('common.deleted'), m.title);
    } catch (err) {
      toast.error(err);
    }
  };

  const columns: Column<MaintenanceWindow>[] = [
    {
      key: 'title',
      header: t('maintenance.col.title'),
      render: (m) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{m.title}</span>
          {m.note && (
            <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
              {m.note}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'scope',
      header: t('maintenance.col.scope'),
      render: (m) => <span className="code">{m.scope || t('common.dash')}</span>,
    },
    {
      key: 'state',
      header: t('maintenance.col.state'),
      render: (m) => (
        <StatusBadge tone={STATE_TONE[m.state]} dot>
          {t(`maintenance.state.${m.state}` as `maintenance.state.scheduled`)}
        </StatusBadge>
      ),
    },
    {
      key: 'starts',
      header: t('maintenance.col.starts'),
      render: (m) => (
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
          {formatDateTime(m.starts_at)}
        </span>
      ),
    },
    {
      key: 'ends',
      header: t('maintenance.col.ends'),
      render: (m) => (
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
          {formatDateTime(m.ends_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (m) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(m)}
          disabled={del.isPending}
          aria-label={t('common.delete')}
        >
          <Icon name="x" size={14} />
        </Button>
      ),
    },
  ];

  return (
    <Card flush>
      <div
        style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Toolbar>
          <ToolbarSpacer />
          <ToolbarMeta>{query.data?.length ?? 0}</ToolbarMeta>
          <Button size="sm" variant="primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={12} />
            {t('maintenance.action.new')}
          </Button>
        </Toolbar>
      </div>
      <MaintenanceFormModal open={newOpen} onClose={() => setNewOpen(false)} />
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('maintenance.empty.title')}
      >
        {(rows) => <DataTable rows={rows} columns={columns} rowKey={(m) => m.id} />}
      </QueryBoundary>
    </Card>
  );
}

function defaultLocalDateTime(addHours: number) {
  const d = new Date(Date.now() + addHours * 3600_000);
  d.setSeconds(0, 0);
  // YYYY-MM-DDTHH:mm in local tz, suitable for <input type="datetime-local">.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MaintenanceFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const add = useAddMaintenance();
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [starts, setStarts] = useState(() => defaultLocalDateTime(0));
  const [ends, setEnds] = useState(() => defaultLocalDateTime(1));
  const [note, setNote] = useState('');

  const close = () => {
    if (add.isPending) return;
    add.reset();
    onClose();
  };

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await add.mutateAsync({
        title: title.trim(),
        scope: scope.trim() || undefined,
        starts_at: new Date(starts).toISOString(),
        ends_at: new Date(ends).toISOString(),
        note: note.trim() || undefined,
      });
      setTitle('');
      setScope('');
      setNote('');
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
      title={t('maintenance.action.new')}
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
      <Field label={t('maintenance.form.title')} required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label={t('maintenance.form.scope')} hint={t('maintenance.form.scopeHint')}>
        <TextInput value={scope} onChange={(e) => setScope(e.target.value)} placeholder="node:orbit / service:traefik" />
      </Field>
      <FieldRow>
        <Field label={t('maintenance.form.starts')} required>
          <TextInput
            type="datetime-local"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
        </Field>
        <Field label={t('maintenance.form.ends')} required>
          <TextInput
            type="datetime-local"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
          />
        </Field>
      </FieldRow>
      <Field label={t('maintenance.form.note')}>
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </Field>
    </Modal>
  );
}
