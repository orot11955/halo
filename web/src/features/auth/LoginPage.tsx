import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { useAuth } from '@/app/AuthContext';
import { useT } from '@/i18n';
import { ApiError } from '@/services/apiClient';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const t = useT();
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError(t('auth.error.missing'));
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        setError(t('auth.error.invalid'));
      } else {
        setError((err as Error)?.message ?? t('auth.error.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>H</div>
          <div className={styles.brandText}>
            <div className={styles.brandName}>halo</div>
            <div className={styles.brandTag}>{t('nav.brand.tagline')}</div>
          </div>
        </div>

        <div className={styles.title}>{t('auth.title')}</div>
        <div className={styles.subtitle}>{t('auth.subtitle')}</div>

        {error && <div className={styles.error}>{error}</div>}

        <Field label={t('auth.username')} required>
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </Field>
        <Field label={t('auth.password')} required>
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? t('auth.submitting') : t('auth.submit')}
          </Button>
        </div>

        <div className={styles.hint}>{t('auth.hint')}</div>
      </form>
    </div>
  );
}
