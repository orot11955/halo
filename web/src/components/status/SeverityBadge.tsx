import type { Severity } from '@/types/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { severityTone } from '@/utils/status';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';

const LABEL_KEY: Record<Severity, TranslationKey> = {
  info: 'severity.info',
  warning: 'severity.warning',
  critical: 'severity.critical',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useT();
  return (
    <StatusBadge tone={severityTone(severity)} variant="solid">
      {t(LABEL_KEY[severity])}
    </StatusBadge>
  );
}
