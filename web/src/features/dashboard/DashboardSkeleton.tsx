import styles from './widgets.module.css';

/**
 * Renders the dashboard layout grid as shimmering placeholders so the
 * page doesn't visually shift when data arrives. Using the same widget
 * counts/spans as the default layout keeps the layout shift minimal.
 */
export function DashboardSkeleton() {
  return (
    <div
      className={styles.skeletonGrid}
      role="status"
      aria-label="Loading dashboard"
    >
      <div className={styles.skeletonCard} />
      <div className={styles.skeletonCard} />
      <div className={styles.skeletonCard} />
      <div className={`${styles.skeletonCard} ${styles.skeletonTall} ${styles.skeletonWide}`} />
      <div className={`${styles.skeletonCard} ${styles.skeletonTall}`} />
      <div className={`${styles.skeletonCard} ${styles.skeletonWide}`} style={{ gridColumn: 'span 3' }} />
    </div>
  );
}
