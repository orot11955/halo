import type { Health } from '@/types/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { healthTone } from '@/utils/status';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';

const LABEL_KEY: Record<Health, TranslationKey> = {
  healthy: 'status.health.healthy',
  warning: 'status.health.warning',
  critical: 'status.health.critical',
  unknown: 'status.health.unknown',
};

export function HealthBadge({ health }: { health: Health }) {
  const t = useT();
  return (
    <StatusBadge tone={healthTone(health)} dot>
      {t(LABEL_KEY[health])}
    </StatusBadge>
  );
}
