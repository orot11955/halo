import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { useAuth } from '@/app/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: IconName;
  end?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'dashboard', end: true },
  { to: '/nodes', labelKey: 'nav.nodes', icon: 'nodes' },
  { to: '/services', labelKey: 'nav.services', icon: 'services' },
  { to: '/domains', labelKey: 'nav.domains', icon: 'globe' },
  { to: '/events', labelKey: 'nav.events', icon: 'inbox' },
];

const OPS_NAV: NavItem[] = [
  { to: '/topology', labelKey: 'nav.topology', icon: 'network' },
  { to: '/runbooks', labelKey: 'nav.runbooks', icon: 'shield' },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings' },
];

export function Sidebar() {
  const t = useT();
  return (
    <>
      <div className={styles.brand}>
        <div className={styles.brandMark} aria-hidden="true">
          <Icon name="activity" size={16} strokeWidth={2.4} />
        </div>
        <div className={styles.brandText}>
          <div className={styles.brandName}>{t('meta.appName')}</div>
          <div className={styles.brandTagline}>{t('nav.brand.tagline')}</div>
        </div>
      </div>
      <nav className={styles.nav}>
        <div className={styles.section}>{t('nav.section.overview')}</div>
        {PRIMARY_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
        <div className={styles.section}>{t('nav.section.ops')}</div>
        {OPS_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
        <div className={styles.section}>{t('nav.section.system')}</div>
        {SECONDARY_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>
      <div className={styles.footer}>
        <UserRow />
        <div className={styles.footerVersion}>
          <span>{t('meta.appVersion')}</span>
          <span className={styles.footerSep}>·</span>
          <span>{t('meta.embedMode')}</span>
        </div>
      </div>
    </>
  );
}

function UserRow() {
  const t = useT();
  const auth = useAuth();
  if (!auth.user) return null;
  return (
    <div className={styles.userRow}>
      <div className={styles.userAvatar}>
        <Icon name="user" size={14} />
      </div>
      <div className={styles.userInfo}>
        <div className={styles.userName} title={auth.user.username}>
          {auth.user.username}
        </div>
        <div className={styles.userLabel}>{t('auth.signedIn')}</div>
      </div>
      <button
        type="button"
        className={styles.logoutBtn}
        onClick={() => void auth.logout()}
        aria-label={t('auth.logout')}
        title={t('auth.logout')}
      >
        <Icon name="log-out" size={14} />
      </button>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const t = useT();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn(styles.link, isActive && styles.linkActive)}
    >
      <span className={styles.icon}>
        <Icon name={item.icon} size={18} />
      </span>
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}
