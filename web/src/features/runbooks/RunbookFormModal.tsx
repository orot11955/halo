import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { useAddRunbook } from '@/hooks/useRunbooks';
import { useT } from '@/i18n';
import type { RunbookStatus, RunbookStep } from '@/types/runbook';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  title: string;
  summary: string;
  status: RunbookStatus;
  scope: string;
  tags: string;
  steps: RunbookStep[];
}

const EMPTY: FormState = {
  title: '',
  summary: '',
  status: 'draft',
  scope: '',
  tags: '',
  steps: [{ title: '', body: '' }],
};

export function RunbookFormModal({ open, onClose }: Props) {
  const t = useT();
  const add = useAddRunbook();
  const [form, setForm] = useState<FormState>(EMPTY);

  const close = () => {
    if (add.isPending) return;
    add.reset();
    setForm(EMPTY);
    onClose();
  };

  const updateStep = (index: number, patch: Partial<RunbookStep>) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addStep = () =>
    setForm((prev) => ({ ...prev, steps: [...prev.steps, { title: '', body: '' }] }));

  const removeStep = (index: number) =>
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.length > 1 ? prev.steps.filter((_, i) => i !== index) : prev.steps,
    }));

  const submit = async () => {
    if (!form.title.trim()) return;
    const cleanSteps = form.steps
      .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
      .filter((s) => s.title || s.body);
    const tagList = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await add.mutateAsync({
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        status: form.status,
        scope: form.scope.trim() || undefined,
        tags: tagList,
        steps: cleanSteps,
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
      onClose={close}
      busy={add.isPending}
      size="lg"
      title={t('runbooks.action.new')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={add.isPending || !form.title.trim()}>
            {add.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      {add.isError && (
        <ModalErrorBanner>{(add.error as Error)?.message ?? t('common.error')}</ModalErrorBanner>
      )}
      <FieldRow>
        <Field label={t('runbooks.form.title')} required>
          <TextInput
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label={t('runbooks.form.status')}>
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as RunbookStatus })}
          >
            <option value="draft">{t('runbooks.status.draft')}</option>
            <option value="verified">{t('runbooks.status.verified')}</option>
            <option value="stale">{t('runbooks.status.stale')}</option>
          </Select>
        </Field>
      </FieldRow>
      <Field label={t('runbooks.form.summary')}>
        <TextArea
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          rows={2}
        />
      </Field>
      <FieldRow>
        <Field label={t('runbooks.form.scope')} hint={t('runbooks.form.scopeHint')}>
          <TextInput
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value })}
            placeholder="global / service / node:orbit"
          />
        </Field>
        <Field label={t('runbooks.form.tags')} hint={t('runbooks.form.tagsHint')}>
          <TextInput
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="node, network"
          />
        </Field>
      </FieldRow>

      <Field label={t('runbooks.form.steps')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {form.steps.map((step, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 999,
                    background: 'var(--color-bg-hover)',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {i + 1}
                </span>
                <TextInput
                  value={step.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  placeholder={t('runbooks.form.stepTitle')}
                />
                {form.steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(i)}
                    aria-label={t('common.delete')}
                  >
                    <Icon name="x" size={12} />
                  </Button>
                )}
              </div>
              <TextArea
                value={step.body}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                placeholder={t('runbooks.form.stepBody')}
                rows={2}
              />
            </div>
          ))}
          <Button size="sm" onClick={addStep}>
            <Icon name="plus" size={12} />
            {t('runbooks.form.addStep')}
          </Button>
        </div>
      </Field>
    </Modal>
  );
}
