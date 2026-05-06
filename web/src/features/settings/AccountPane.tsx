import { useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/ui/Grid';
import { Descriptions } from '@/components/ui/Descriptions';
import { Field, FieldRow, TextInput } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/services/apiClient';
import { changePassword } from '@/services/authApi';
import { useAuth } from '@/app/AuthContext';
import { useMutationToast } from '@/hooks/useDeleteAction';
import { useT } from '@/i18n';

export function AccountPane() {
  const t = useT();
  const auth = useAuth();
  return (
    <Grid cols={2}>
      <Card title={t('settings.account.title')} subtitle={t('settings.account.subtitle')}>
        <Descriptions
          items={[
            {
              label: t('settings.account.username'),
              value: <span className="code">{auth.user?.username ?? '—'}</span>,
            },
            {
              label: t('settings.account.signedIn'),
              value: t('auth.signedIn'),
            },
          ]}
        />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button onClick={() => void auth.logout()}>
            <Icon name="x" size={14} />
            {t('auth.logout')}
          </Button>
        </div>
      </Card>
      <PasswordCard />
    </Grid>
  );
}

function PasswordCard() {
  const t = useT();
  const toast = useMutationToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current || !next) {
      setError(t('settings.password.error.required'));
      return;
    }
    if (next.length < 8) {
      setError(t('settings.password.error.tooShort'));
      return;
    }
    if (next !== confirm) {
      setError(t('settings.password.error.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      toast.success(t('settings.password.success'));
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        setError(t('settings.password.error.invalid'));
      } else {
        setError((err as Error)?.message ?? t('common.error'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('settings.password.title')} subtitle={t('settings.password.subtitle')}>
      <form onSubmit={submit}>
        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(239, 83, 80, 0.12)',
              border: '1px solid rgba(239, 83, 80, 0.45)',
              color: 'var(--color-danger)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-3)',
            }}
          >
            {error}
          </div>
        )}
        <Field label={t('settings.password.current')} required>
          <TextInput
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <FieldRow>
          <Field label={t('settings.password.new')} required hint={t('settings.password.hint')}>
            <TextInput
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t('settings.password.confirm')} required>
            <TextInput
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </FieldRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t('common.saving') : t('settings.password.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
