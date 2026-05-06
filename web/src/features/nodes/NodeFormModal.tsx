import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow, TextInput } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { useAddNode } from '@/hooks/useNodes';
import { useT } from '@/i18n';
import type { AddNodeInput } from '@/services/nodeApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NodeFormModal({ open, onClose }: Props) {
  const t = useT();
  const add = useAddNode();
  const [form, setForm] = useState<AddNodeInput>({ name: '', url: '' });

  const reset = () => setForm({ name: '', url: '' });

  const handleClose = () => {
    if (add.isPending) return;
    add.reset();
    reset();
    onClose();
  };

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    try {
      await add.mutateAsync({
        name: form.name.trim(),
        url: form.url.trim(),
        display_name: form.display_name?.trim() || undefined,
        role: form.role?.trim() || undefined,
        ip_address: form.ip_address?.trim() || undefined,
      });
      reset();
      onClose();
    } catch {
      /* surfaced below */
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      busy={add.isPending}
      title={t('nodes.action.add')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={add.isPending || !form.name.trim() || !form.url.trim()}
          >
            {add.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      {add.isError && (
        <ModalErrorBanner>{(add.error as Error)?.message ?? t('common.error')}</ModalErrorBanner>
      )}
      <FieldRow>
        <Field label={t('nodes.form.name')} required hint={t('nodes.form.nameHint')}>
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="orbit"
            autoFocus
          />
        </Field>
        <Field label={t('nodes.form.displayName')}>
          <TextInput
            value={form.display_name ?? ''}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="Orbit (main)"
          />
        </Field>
      </FieldRow>
      <Field label={t('nodes.form.url')} required hint={t('nodes.form.urlHint')}>
        <TextInput
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="http://192.168.1.10:7311"
        />
      </Field>
      <FieldRow>
        <Field label={t('nodes.form.role')}>
          <TextInput
            value={form.role ?? ''}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="proxmox / nas / lxc-host"
          />
        </Field>
        <Field label={t('nodes.form.ip')}>
          <TextInput
            value={form.ip_address ?? ''}
            onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
            placeholder="192.168.1.10"
          />
        </Field>
      </FieldRow>
    </Modal>
  );
}
