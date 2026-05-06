import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { useT } from '@/i18n';
import { EventsList } from './EventsList';
import { AuditLog } from './AuditLog';
import { MaintenanceList } from './MaintenanceList';

type Tab = 'all' | 'alerts' | 'audit' | 'maintenance';

function tabFromParam(value: string | null): Tab {
  switch (value) {
    case 'alerts':
    case 'audit':
    case 'maintenance':
      return value;
    default:
      return 'all';
  }
}

export function EventsPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get('tab')));

  useEffect(() => {
    setTab(tabFromParam(searchParams.get('tab')));
  }, [searchParams]);

  const setTabAndUrl = (next: Tab) => {
    setTab(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'all') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <Page title={t('events.title')} streamConnected>
      <PageHeader title={t('events.title')} subtitle={t('events.subtitle')} />

      <Tabs<Tab>
        value={tab}
        onChange={setTabAndUrl}
        items={[
          { value: 'all', label: t('events.tab.all') },
          { value: 'alerts', label: t('events.tab.alerts') },
          { value: 'audit', label: t('events.tab.audit') },
          { value: 'maintenance', label: t('events.tab.maintenance') },
        ]}
      />

      {tab === 'all' && <EventsList />}
      {tab === 'alerts' && <EventsList alertsOnly />}
      {tab === 'audit' && <AuditLog />}
      {tab === 'maintenance' && <MaintenanceList />}
    </Page>
  );
}
