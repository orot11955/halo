import type { Status } from '@/types/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { nodeStatusTone } from '@/utils/status';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';

const LABEL_KEY: Record<Status, TranslationKey> = {
  online: 'status.node.online',
  offline: 'status.node.offline',
  warning: 'status.node.warning',
  unknown: 'status.node.unknown',
};

export function NodeStatusBadge({ status }: { status: Status }) {
  const t = useT();
  return (
    <StatusBadge tone={nodeStatusTone(status)} dot>
      {t(LABEL_KEY[status])}
    </StatusBadge>
  );
}
