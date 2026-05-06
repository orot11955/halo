import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import { Header } from './Header';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface PageProps {
  title: string;
  crumbs?: string[];
  headerActions?: ReactNode;
  streamConnected?: boolean;
  children: ReactNode;
}

export function Page({ title, crumbs, headerActions, streamConnected, children }: PageProps) {
  useDocumentTitle(crumbs?.length ? `${title} · ${crumbs.join(' / ')}` : title);
  return (
    <AppShell
      header={
        <Header
          title={title}
          crumbs={crumbs}
          actions={headerActions}
          streamConnected={streamConnected}
        />
      }
    >
      {children}
    </AppShell>
  );
}
