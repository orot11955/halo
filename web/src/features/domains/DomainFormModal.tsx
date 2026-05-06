import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow, TextInput } from '@/components/ui/Field';
import { Modal, ModalErrorBanner } from '@/components/ui/Modal';
import { useAddDomain } from '@/hooks/useDomains';
import { useT } from '@/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DomainFormModal({ open, onClose }: Props) {
  const t = useT();
  const add = useAddDomain();
  const [name, setName] = useState('');
  const [expectedIP, setExpectedIP] = useState('');

  const handleClose = () => {
    if (add.isPending) return;
    add.reset();
    setName('');
    setExpectedIP('');
    onClose();
  };

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await add.mutateAsync({
        name: name.trim(),
        expected_ip: expectedIP.trim() || undefined,
      });
      setName('');
      setExpectedIP('');
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
      title={t('domains.action.add')}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={add.isPending || !name.trim()}
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
        <Field label={t('domains.form.name')} required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="orot.dev"
            autoFocus
          />
        </Field>
        <Field label={t('domains.form.expectedIp')} hint={t('domains.form.expectedIpHint')}>
          <TextInput
            value={expectedIP}
            onChange={(e) => setExpectedIP(e.target.value)}
            placeholder="123.45.67.89"
          />
        </Field>
      </FieldRow>
    </Modal>
  );
}
