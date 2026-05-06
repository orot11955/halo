import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { NodeStatusBadge } from '@/components/status/NodeStatusBadge';
import { useNode, useRefreshNode } from '@/hooks/useNodes';
import { useMutationToast } from '@/hooks/useDeleteAction';
import { useT } from '@/i18n';
import { NodeOverview } from './NodeOverview';
import { NodeMetrics } from '../metrics/NodeMetrics';
import { NodeContainers } from './NodeContainers';
import { NodePorts } from './NodePorts';
import { NodeLogs } from './NodeLogs';
import { NodeNotes } from './NodeNotes';

type Tab = 'overview' | 'metrics' | 'containers' | 'logs' | 'ports' | 'notes';

const TAB_PATHS: Record<Tab, string> = {
  overview: '',
  metrics: 'metrics',
  containers: 'containers',
  logs: 'logs',
  ports: 'ports',
  notes: 'notes',
};

function tabFromPath(pathname: string): Tab {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  switch (last) {
    case 'metrics':
      return 'metrics';
    case 'containers':
      return 'containers';
    case 'logs':
      return 'logs';
    case 'ports':
      return 'ports';
    case 'notes':
      return 'notes';
    default:
      return 'overview';
  }
}

export function NodeDetailPage() {
  const t = useT();
  const params = useParams<{ name: string }>();
  const name = params.name ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const tab = tabFromPath(location.pathname);
  const query = useNode(name);
  const refresh = useRefreshNode();
  const toast = useMutationToast();

  const onTabChange = (next: Tab) => {
    const suffix = TAB_PATHS[next];
    navigate(suffix ? `/nodes/${name}/${suffix}` : `/nodes/${name}`);
  };

  const onRefreshMetrics = () => {
    if (!name) return;
    refresh.mutate(name, {
      onSuccess: () => toast.success(t('nodes.action.refresh'), name),
      onError: (err) => toast.error(err),
    });
  };

  return (
    <Page title={query.data?.display_name ?? name} crumbs={[t('nav.nodes')]}>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {query.data?.display_name ?? name}
            {query.data && <NodeStatusBadge status={query.data.status} />}
          </span>
        }
        subtitle={query.data ? `${query.data.hostname} · ${query.data.ip}` : undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/nodes')}>
              <Icon name="arrow-left" size={14} />
              {t('common.back')}
            </Button>
            <Button onClick={onRefreshMetrics} disabled={refresh.isPending || !name}>
              <Icon name="refresh" size={14} />
              {t('nodes.action.refresh')}
            </Button>
          </>
        }
      />

      <Tabs<Tab>
        value={tab}
        onChange={onTabChange}
        items={[
          { value: 'overview', label: t('nodeDetail.tab.overview') },
          { value: 'metrics', label: t('nodeDetail.tab.metrics') },
          { value: 'containers', label: t('nodeDetail.tab.containers') },
          { value: 'logs', label: t('nodeDetail.tab.logs') },
          { value: 'ports', label: t('nodeDetail.tab.ports') },
          { value: 'notes', label: t('nodeDetail.tab.notes') },
        ]}
      />

      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        loadingLabel={t('common.loading')}
      >
        {(node) => {
          switch (tab) {
            case 'overview':
              return <NodeOverview node={node} />;
            case 'metrics':
              return <NodeMetrics name={node.name} />;
            case 'containers':
              return <NodeContainers name={node.name} />;
            case 'logs':
              return <NodeLogs name={node.name} />;
            case 'ports':
              return <NodePorts name={node.name} />;
            case 'notes':
              return <NodeNotes name={node.name} />;
          }
        }}
      </QueryBoundary>
    </Page>
  );
}
