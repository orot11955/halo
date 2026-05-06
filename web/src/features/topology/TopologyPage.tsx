import { useState } from 'react';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { NetworkMap } from './NetworkMap';
import { HardwareAssets } from './HardwareAssets';
import { ImpactView } from './ImpactView';
import { AssetFormModal } from './AssetFormModal';
import { ConnectionFormModal } from './ConnectionFormModal';

type Tab = 'network' | 'assets' | 'impact';

export function TopologyPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('network');
  const [addOpen, setAddOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <Page title={t('topology.title')}>
      <PageHeader
        title={t('topology.title')}
        subtitle={t('topology.subtitle')}
        actions={
          <>
            <Button onClick={() => setConnectOpen(true)}>
              <Icon name="network" size={14} />
              {t('topology.action.addConnection')}
            </Button>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={14} />
              {t('topology.action.addAsset')}
            </Button>
          </>
        }
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'network', label: t('topology.tab.network') },
          { value: 'assets', label: t('topology.tab.assets') },
          { value: 'impact', label: t('topology.tab.impact') },
        ]}
      />

      {tab === 'network' && <NetworkMap />}
      {tab === 'assets' && <HardwareAssets />}
      {tab === 'impact' && <ImpactView />}

      <AssetFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ConnectionFormModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </Page>
  );
}
