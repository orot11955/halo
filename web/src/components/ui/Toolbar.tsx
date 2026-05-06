import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useT } from '@/i18n';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  children: ReactNode;
}

export function Toolbar({ children }: ToolbarProps) {
  return <div className={styles.toolbar}>{children}</div>;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const t = useT();
  return (
    <div className={styles.searchWrap}>
      <span className={styles.searchIcon}>
        <Icon name="search" size={14} />
      </span>
      <input
        className={styles.search}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('common.search')}
      />
    </div>
  );
}

export function ToolbarSpacer() {
  return <div className={styles.spacer} />;
}

export function ToolbarMeta({ children }: { children: ReactNode }) {
  return <div className={styles.meta}>{children}</div>;
}
