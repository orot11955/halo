import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { useAddService } from '@/hooks/useServices';
import { useNodeList } from '@/hooks/useNodes';
import { useT } from '@/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  node_name: string;
  kind: string;
  port: string;
  health_check_url: string;
  note: string;
}

const EMPTY: FormState = {
  name: '',
  node_name: '',
  kind: '',
  port: '',
  health_check_url: '',
  note: '',
};

export function ServiceFormModal({ open, onClose }: Props) {
  const t = useT();
  const add = useAddService();
  const nodes = useNodeList();
  const [form, setForm] = useState<FormState>(EMPTY);

  const handleClose = () => {
    if (add.isPending) return;
    add.reset();
    setForm(EMPTY);
    onClose();
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    const portValue = form.port.trim() ? Number(form.port) : undefined;
    if (portValue !== undefined && (Number.isNaN(portValue) || portValue <= 0)) return;
    try {
      await add.mutateAsync({
        name: form.name.trim(),
        node_name: form.node_name || undefined,
        kind: form.kind.trim() || undefined,
        port: portValue,
        health_check_url: form.health_check_url.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setForm(EMPTY);
      onClose();
    } catch {
      /* surfaced */
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      busy={add.isPending}
      title={t('services.action.register')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={add.isPending || !form.name.trim()}
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
        <Field label={t('services.form.name')} required>
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="traefik"
            autoFocus
          />
        </Field>
        <Field label={t('services.form.node')} hint={t('services.form.nodeHint')}>
          <Select
            value={form.node_name}
            onChange={(e) => setForm({ ...form, node_name: e.target.value })}
          >
            <option value="">{t('common.dash')}</option>
            {(nodes.data ?? []).map((n) => (
              <option key={n.name} value={n.name}>
                {n.display_name} ({n.name})
              </option>
            ))}
          </Select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label={t('services.form.kind')}>
          <TextInput
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            placeholder="systemd / docker / lxc"
          />
        </Field>
        <Field label={t('services.form.port')}>
          <TextInput
            value={form.port}
            onChange={(e) => setForm({ ...form, port: e.target.value })}
            placeholder="8080"
            inputMode="numeric"
          />
        </Field>
      </FieldRow>
      <Field label={t('services.form.healthUrl')} hint={t('services.form.healthUrlHint')}>
        <TextInput
          value={form.health_check_url}
          onChange={(e) => setForm({ ...form, health_check_url: e.target.value })}
          placeholder="https://service.example.com/healthz"
        />
      </Field>
      <Field label={t('services.form.note')}>
        <TextArea
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          rows={3}
        />
      </Field>
    </Modal>
  );
}
