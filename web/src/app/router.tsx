import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

// Code-split each route. The eagerly-imported NotFoundPage stays in the
// main bundle so unmatched URLs render instantly. Everything else lives
// in its own chunk loaded on first navigation.
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const NodeListPage = lazy(() =>
  import('@/features/nodes/NodeListPage').then((m) => ({ default: m.NodeListPage })),
);
const NodeDetailPage = lazy(() =>
  import('@/features/nodes/NodeDetailPage').then((m) => ({ default: m.NodeDetailPage })),
);
const ServicesPage = lazy(() =>
  import('@/features/services/ServicesPage').then((m) => ({ default: m.ServicesPage })),
);
const DomainsPage = lazy(() =>
  import('@/features/domains/DomainsPage').then((m) => ({ default: m.DomainsPage })),
);
const EventsPage = lazy(() =>
  import('@/features/events/EventsPage').then((m) => ({ default: m.EventsPage })),
);
const TopologyPage = lazy(() =>
  import('@/features/topology/TopologyPage').then((m) => ({ default: m.TopologyPage })),
);
const RunbooksPage = lazy(() =>
  import('@/features/runbooks/RunbooksPage').then((m) => ({ default: m.RunbooksPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-sm)',
      }}
    >
      …
    </div>
  );
}

function L({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  { path: '/', element: <L><DashboardPage /></L> },
  { path: '/nodes', element: <L><NodeListPage /></L> },
  { path: '/nodes/:name', element: <L><NodeDetailPage /></L> },
  { path: '/nodes/:name/metrics', element: <L><NodeDetailPage /></L> },
  { path: '/nodes/:name/containers', element: <L><NodeDetailPage /></L> },
  { path: '/nodes/:name/logs', element: <L><NodeDetailPage /></L> },
  { path: '/nodes/:name/ports', element: <L><NodeDetailPage /></L> },
  { path: '/nodes/:name/notes', element: <L><NodeDetailPage /></L> },
  { path: '/services', element: <L><ServicesPage /></L> },
  { path: '/domains', element: <L><DomainsPage /></L> },
  { path: '/topology', element: <L><TopologyPage /></L> },
  { path: '/events', element: <L><EventsPage /></L> },
  { path: '/runbooks', element: <L><RunbooksPage /></L> },
  { path: '/settings', element: <L><SettingsPage /></L> },
  { path: '*', element: <NotFoundPage /> },
]);
