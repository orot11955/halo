import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { issueAppPairingCode, type AppPairingCode } from '@/services/adminApi';
import { useT } from '@/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AppPairingModal({ open, onClose }: Props) {
  const t = useT();
  const [name, setName] = useState('Halo app');
  const [ttl, setTtl] = useState('300');
  const [issued, setIssued] = useState<AppPairingCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setName('Halo app');
    setTtl('300');
    setIssued(null);
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await issueAppPairingCode({
        name: name.trim() || undefined,
        expires_in_seconds: Number(ttl),
      });
      setIssued(result);
    } catch (err) {
      setError((err as Error)?.message ?? t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!issued) return;
    void navigator.clipboard.writeText(issued.code).catch(() => {
      /* clipboard unavailable */
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      busy={busy}
      title={t('settings.appPairing.title')}
      footer={
        issued ? (
          <Button variant="primary" onClick={close}>
            {t('common.close')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? t('common.saving') : t('settings.appPairing.issue')}
            </Button>
          </>
        )
      }
    >
      {error && <ModalErrorBanner>{error}</ModalErrorBanner>}

      {issued ? (
        <>
          <p style={{ color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
            {t('settings.appPairing.issuedHint', { name: issued.name })}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 'var(--space-3)',
            }}
          >
            <code
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                wordBreak: 'break-all',
                color: 'var(--color-text)',
              }}
            >
              {issued.code}
            </code>
            <Button size="sm" onClick={copyCode} aria-label={t('settings.appPairing.copy')}>
              <Icon name="key" size={12} />
              {t('settings.appPairing.copy')}
            </Button>
          </div>
          <p
            style={{
              marginTop: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-warning)',
            }}
          >
            {t('settings.appPairing.expiresAt', {
              time: new Date(issued.expires_at).toLocaleTimeString(),
            })}
          </p>
        </>
      ) : (
        <>
          <Field label={t('settings.appPairing.name')}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={t('settings.appPairing.ttl')}>
            <Select value={ttl} onChange={(e) => setTtl(e.target.value)}>
              <option value="300">5 min</option>
              <option value="600">10 min</option>
              <option value="900">15 min</option>
            </Select>
          </Field>
        </>
      )}
    </Modal>
  );
}
