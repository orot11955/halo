import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import styles from './AppShell.module.css';

interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, children }: AppShellProps) {
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever we navigate to a new route, otherwise
  // tapping a sidebar link leaves it covering the page.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open so background content
  // doesn't pan around when the user swipes inside the sidebar.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}
        aria-hidden={!mobileOpen ? undefined : false}
      >
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div
          className={styles.scrim}
          role="presentation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <header className={styles.header}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={t('nav.menu')}
          aria-expanded={mobileOpen}
        >
          <Icon name="menu" size={18} />
        </button>
        <div className={styles.headerInner}>{header}</div>
      </header>
      <main className={styles.content} id="halo-main" tabIndex={-1}>
        <div className={styles.contentInner}>{children}</div>
      </main>
    </div>
  );
}
