import { useMemo, useState, type ReactNode } from 'react';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { useDashboard } from '@/hooks/useDashboard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/States';
import { useT } from '@/i18n';
import type { DashboardSummary } from '@/types/dashboard';
import { SummaryWidget } from './SummaryWidget';
import { ResourceWidget } from './ResourceWidget';
import { EventsWidget } from './EventsWidget';
import { AlertsWidget } from './AlertsWidget';
import { MaintenanceWidget } from './MaintenanceWidget';
import { AuditWidget } from './AuditWidget';
import { OnboardingPanel } from './OnboardingPanel';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DashboardGrid } from './DashboardGrid';
import { useDashboardLayout } from './dashboardLayout';

export function DashboardPage() {
  const t = useT();
  const query = useDashboard();
  const layout = useDashboardLayout();
  const [editing, setEditing] = useState(false);

  const visibleIds = useMemo(() => layout.visible.map((w) => w.id), [layout.visible]);
  const hiddenWidgets = useMemo(
    () => layout.layout.widgets.filter((w) => !w.visible),
    [layout.layout.widgets],
  );

  return (
    <Page title={t('nav.dashboard')}>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            {editing && (
              <Button onClick={() => layout.reset()}>
                <Icon name="refresh" size={14} />
                {t('dashboard.customize.reset')}
              </Button>
            )}
            <Button
              variant={editing ? 'primary' : 'default'}
              onClick={() => setEditing((v) => !v)}
            >
              <Icon name={editing ? 'check' : 'settings'} size={14} />
              {editing ? t('dashboard.customize.done') : t('dashboard.customize.start')}
            </Button>
            <Button onClick={() => query.refetch()}>
              <Icon name="refresh" size={14} />
              {t('common.refresh')}
            </Button>
          </>
        }
      />

      {query.isLoading && !query.data ? (
        <DashboardSkeleton />
      ) : query.error && !query.data ? (
        <ErrorState error={query.error as Error} />
      ) : query.data && query.data.nodes.total === 0 ? (
        // Fresh install: skip the empty stat cards and show guided setup
        // until at least one node is registered.
        <OnboardingPanel />
      ) : query.data ? (
        <DashboardGrid
          visible={layout.visible}
          hidden={hiddenWidgets}
          editing={editing}
          renderWidget={(id) => renderWidget(id, query.data as DashboardSummary, t)}
          onMove={layout.move}
          onSpanChange={layout.setSpan}
          onShow={(id) => layout.setVisible(id, true)}
          onHide={(id) => layout.setVisible(id, false)}
        />
      ) : null}

      {/* Hidden in render, but keeps `visibleIds` referenced so future hooks
          (e.g. server-persisted layout) can wire onto it cleanly. */}
      <span hidden data-widget-ids={visibleIds.join(',')} />
    </Page>
  );
}

function renderWidget(
  id: string,
  summary: DashboardSummary,
  t: ReturnType<typeof useT>,
): ReactNode {
  switch (id) {
    case 'summary.nodes':
      return (
        <SummaryWidget
          widgetId="dashboard.nodes"
          icon="nodes"
          title={t('dashboard.card.nodes')}
          total={summary.nodes.total}
          unit={t('dashboard.unit.nodes')}
          href="/nodes"
          items={[
            { label: t('dashboard.label.online'), value: summary.nodes.online, tone: 'success', href: '/nodes?status=online' },
            { label: t('dashboard.label.warning'), value: summary.nodes.warning, tone: 'warning', href: '/nodes?status=warning' },
            { label: t('dashboard.label.offline'), value: summary.nodes.offline, tone: 'danger', href: '/nodes?status=offline' },
          ]}
        />
      );
    case 'summary.services':
      return (
        <SummaryWidget
          widgetId="dashboard.services"
          icon="services"
          title={t('dashboard.card.services')}
          total={summary.services.total}
          unit={t('dashboard.unit.services')}
          href="/services"
          items={[
            { label: t('dashboard.label.healthy'), value: summary.services.healthy, tone: 'success', href: '/services?health=healthy' },
            { label: t('dashboard.label.warning'), value: summary.services.warning, tone: 'warning', href: '/services?health=warning' },
            { label: t('dashboard.label.unknown'), value: summary.services.unknown, tone: 'neutral', href: '/services?health=unknown' },
          ]}
        />
      );
    case 'summary.domains':
      return (
        <SummaryWidget
          widgetId="dashboard.domains"
          icon="globe"
          title={t('dashboard.card.domains')}
          total={summary.domains.total}
          unit={t('dashboard.unit.domains')}
          href="/domains"
          items={[
            {
              label: t('dashboard.label.ok'),
              value: summary.domains.total - summary.domains.ssl_warning,
              tone: 'success',
              href: '/domains?status=ok',
            },
            {
              label: t('dashboard.label.sslWarn'),
              value: summary.domains.ssl_warning,
              tone: 'warning',
              href: '/domains?status=warning',
            },
          ]}
        />
      );
    case 'alerts':
      return <AlertsWidget events={summary.events.recent} unresolved={summary.events.unresolved} />;
    case 'resources':
      return (
        <ResourceWidget
          cpuAvg={summary.resources.cpu_used_percent_avg}
          memoryAvg={summary.resources.memory_used_percent_avg}
          diskMax={summary.resources.disk_used_percent_max}
        />
      );
    case 'maintenance':
      return <MaintenanceWidget />;
    case 'audit':
      return <AuditWidget />;
    case 'events':
      return <EventsWidget events={summary.events.recent} unresolved={summary.events.unresolved} />;
    default:
      return null;
  }
}
