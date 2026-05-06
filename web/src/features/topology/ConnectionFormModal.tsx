import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow, Select, TextInput } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { useCreateConnection, useTopologyGraph } from '@/hooks/useTopology';
import { useT } from '@/i18n';
import type { AssetConnection } from '@/types/topology';

interface Props {
  open: boolean;
  onClose: () => void;
}

const KINDS: NonNullable<AssetConnection['kind']>[] = [
  'ethernet',
  'wifi',
  'fiber',
  'usb',
  'power',
];

export function ConnectionFormModal({ open, onClose }: Props) {
  const t = useT();
  const create = useCreateConnection();
  const graph = useTopologyGraph();
  const assets = useMemo(() => graph.data?.assets ?? [], [graph.data]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<NonNullable<AssetConnection['kind']>>('ethernet');
  const [label, setLabel] = useState('');

  const handleClose = () => {
    if (create.isPending) return;
    create.reset();
    setFrom('');
    setTo('');
    setKind('ethernet');
    setLabel('');
    onClose();
  };

  const submit = async () => {
    if (!from || !to || from === to) return;
    try {
      await create.mutateAsync({
        from,
        to,
        kind,
        label: label.trim() || undefined,
      });
      handleClose();
    } catch {
      /* surfaced */
    }
  };

  const canSubmit = from && to && from !== to && !create.isPending;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      busy={create.isPending}
      title={t('topology.action.addConnection')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>
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
        <Field label={t('topology.form.from')} required>
          <Select value={from} onChange={(e) => setFrom(e.target.value)} autoFocus>
            <option value="">{t('common.dash')}</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('topology.form.to')} required>
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t('common.dash')}</option>
            {assets
              .filter((a) => a.id !== from)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label={t('topology.form.connectionKind')}>
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`topology.connection.${k}` as `topology.connection.ethernet`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('topology.form.label')} hint={t('topology.form.labelHint')}>
          <TextInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="LAN1"
          />
        </Field>
      </FieldRow>
    </Modal>
  );
}
