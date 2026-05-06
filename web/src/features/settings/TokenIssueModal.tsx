import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { nodeKeys, useNodeList } from '@/hooks/useNodes';
import { issueNodeToken, type IssuedToken } from '@/services/adminApi';
import { useT } from '@/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TokenIssueModal({ open, onClose }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const nodes = useNodeList();
  const [nodeName, setNodeName] = useState('');
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setIssued(null);
    setError(null);
    setNodeName('');
    onClose();
  };

  const submit = async () => {
    if (!nodeName) return;
    setError(null);
    setBusy(true);
    try {
      const result = await issueNodeToken(nodeName);
      setIssued(result);
      void qc.invalidateQueries({ queryKey: nodeKeys.all });
    } catch (err) {
      setError((err as Error)?.message ?? t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const selectedNode = nodes.data?.find((n) => n.name === (issued?.node_name ?? nodeName));
  const joinCommand = issued
    ? buildHalonInitCommand(issued.node_name, issued.token, selectedNode?.url)
    : '';

  const copyText = (value: string) => {
    void navigator.clipboard.writeText(value).catch(() => {
      /* clipboard unavailable */
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      busy={busy}
      title={t('settings.tokens.issue')}
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
            <Button variant="primary" onClick={submit} disabled={busy || !nodeName}>
              {busy ? t('common.saving') : t('settings.tokens.issue')}
            </Button>
          </>
        )
      }
    >
      {error && <ModalErrorBanner>{error}</ModalErrorBanner>}

      {issued ? (
        <>
          <p style={{ color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
            {t('settings.tokens.issuedHint', { name: issued.node_name })}
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
              {issued.token}
            </code>
            <Button
              size="sm"
              onClick={() => copyText(issued.token)}
              aria-label={t('settings.tokens.copy')}
            >
              <Icon name="key" size={12} />
              {t('settings.tokens.copy')}
            </Button>
          </div>
          <p
            style={{
              marginTop: 'var(--space-4)',
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            {t('settings.tokens.commandHint')}
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
              {joinCommand}
            </code>
            <Button
              size="sm"
              onClick={() => copyText(joinCommand)}
              aria-label={t('settings.tokens.copyCommand')}
            >
              <Icon name="arrow-right" size={12} />
              {t('settings.tokens.copyCommand')}
            </Button>
          </div>
          <p
            style={{
              marginTop: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-warning)',
            }}
          >
            {t('settings.tokens.warning')}
          </p>
        </>
      ) : (
        <Field label={t('settings.tokens.targetNode')} required>
          <Select value={nodeName} onChange={(e) => setNodeName(e.target.value)} autoFocus>
            <option value="">{t('common.dash')}</option>
            {(nodes.data ?? []).map((n) => (
              <option key={n.name} value={n.name}>
                {n.display_name} ({n.name})
              </option>
            ))}
          </Select>
        </Field>
      )}
    </Modal>
  );
}

function buildHalonInitCommand(nodeName: string, token: string, nodeUrl?: string) {
  return [
    'halon',
    'init',
    '--name',
    shellQuote(nodeName),
    '--listen',
    shellQuote(listenAddressFromUrl(nodeUrl)),
    '--token',
    shellQuote(token),
  ].join(' ');
}

function listenAddressFromUrl(nodeUrl?: string) {
  if (!nodeUrl) return ':7311';
  try {
    const parsed = new URL(nodeUrl);
    return parsed.port ? `:${parsed.port}` : ':7311';
  } catch {
    return ':7311';
  }
}

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
