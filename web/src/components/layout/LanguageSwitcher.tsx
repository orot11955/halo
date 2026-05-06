import { Icon } from '@/components/ui/Icon';
import { useI18n, SUPPORTED_LOCALES, LOCALE_LABELS } from '@/i18n';
import styles from './LanguageSwitcher.module.css';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className={styles.wrap} role="group" aria-label={t('header.language')}>
      <Icon name="language" size={14} className={styles.icon} />
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={code === locale ? `${styles.btn} ${styles.active}` : styles.btn}
          onClick={() => setLocale(code)}
          aria-pressed={code === locale}
          title={LOCALE_LABELS[code]}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
