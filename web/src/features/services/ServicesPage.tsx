import { useState } from 'react';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { ServicesCatalog } from './ServicesCatalog';
import { ServiceHealthChecks } from './ServiceHealthChecks';
import { ServiceDependencies } from './ServiceDependencies';
import { ServiceFormModal } from './ServiceFormModal';

type Tab = 'catalog' | 'health' | 'dependencies';

export function ServicesPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('catalog');
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <Page title={t('services.title')}>
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        actions={
          <Button variant="primary" onClick={() => setRegisterOpen(true)}>
            <Icon name="plus" size={14} />
            {t('services.action.register')}
          </Button>
        }
      />
      <ServiceFormModal open={registerOpen} onClose={() => setRegisterOpen(false)} />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'catalog', label: t('services.tab.catalog') },
          { value: 'health', label: t('services.tab.healthChecks') },
          { value: 'dependencies', label: t('services.tab.dependencies') },
        ]}
      />

      {tab === 'catalog' && <ServicesCatalog />}
      {tab === 'health' && <ServiceHealthChecks />}
      {tab === 'dependencies' && <ServiceDependencies />}
    </Page>
  );
}
