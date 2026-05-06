import { Link } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useT } from '@/i18n';

export function NotFoundPage() {
  const t = useT();
  return (
    <Page title={t('notFound.title')}>
      <Card>
        <EmptyState
          icon="x"
          title={t('notFound.heading')}
          detail={
            <span>
              {t('notFound.detail')}{' '}
              <Link to="/" style={{ color: 'var(--color-accent)' }}>
                {t('nav.dashboard')}
              </Link>
            </span>
          }
        />
      </Card>
    </Page>
  );
}
