import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { useCreateAsset } from '@/hooks/useTopology';
import { useT } from '@/i18n';
import type { AssetKind, CreateAssetInput } from '@/types/topology';

const ASSET_KINDS: AssetKind[] = [
  'router',
  'switch',
  'access_point',
  'server',
  'nas',
  'desktop',
  'laptop',
  'lxc',
  'vm',
  'docker_host',
  'ups',
  'external_disk',
  'camera',
  'monitor',
  'patch_panel',
  'kvm',
  'internet',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AssetFormModal({ open, onClose }: Props) {
  const t = useT();
  const create = useCreateAsset();
  const [form, setForm] = useState<CreateAssetInput>({
    kind: 'server',
    name: '',
  });

  const reset = () => setForm({ kind: 'server', name: '' });

  const handleClose = () => {
    if (create.isPending) return;
    create.reset();
    reset();
    onClose();
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    const payload: CreateAssetInput = {
      kind: form.kind,
      name: form.name.trim(),
      ip: form.ip?.trim() || undefined,
      mac: form.mac?.trim() || undefined,
      vendor: form.vendor?.trim() || undefined,
      model: form.model?.trim() || undefined,
      location: form.location?.trim() || undefined,
      note: form.note?.trim() || undefined,
    };
    try {
      await create.mutateAsync(payload);
      reset();
      onClose();
    } catch {
      // error rendered below
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      busy={create.isPending}
      title={t('topology.action.addAsset')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={create.isPending || !form.name.trim()}
          >
            {create.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      {create.isError && (
        <ModalErrorBanner>
          {(create.error as Error)?.message ?? t('common.error')}
        </ModalErrorBanner>
      )}
      <FieldRow>
        <Field label={t('topology.form.kind')} required>
          <Select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as AssetKind })}
          >
            {ASSET_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`topology.kind.${k}` as `topology.kind.server`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('topology.form.name')} required>
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="ipTIME SG16A"
            autoFocus
          />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label={t('topology.form.ip')} hint={t('topology.form.ipHint')}>
          <TextInput
            value={form.ip ?? ''}
            onChange={(e) => setForm({ ...form, ip: e.target.value })}
            placeholder="192.168.1.10"
          />
        </Field>
        <Field label={t('topology.form.mac')}>
          <TextInput
            value={form.mac ?? ''}
            onChange={(e) => setForm({ ...form, mac: e.target.value })}
            placeholder="aa:bb:cc:dd:ee:ff"
          />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label={t('topology.form.vendor')}>
          <TextInput
            value={form.vendor ?? ''}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          />
        </Field>
        <Field label={t('topology.form.model')}>
          <TextInput
            value={form.model ?? ''}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </Field>
      </FieldRow>
      <Field label={t('topology.form.location')}>
        <TextInput
          value={form.location ?? ''}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="rack-1 / desk / closet"
        />
      </Field>
      <Field label={t('topology.form.note')}>
        <TextArea
          value={form.note ?? ''}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          rows={3}
        />
      </Field>
    </Modal>
  );
}
