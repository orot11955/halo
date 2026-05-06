import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { EmptyState } from '@/components/ui/States';
import { useT } from '@/i18n';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  width?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: ReactNode;
  emptyMessage?: ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  emptyTitle,
  emptyMessage,
}: DataTableProps<T>) {
  const t = useT();
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle ?? t('state.empty.noMatches')} detail={emptyMessage} />;
  }

  const activateRow = (row: T) => {
    onRowClick?.(row);
  };

  const onRowKeyDown = (row: T) => (event: KeyboardEvent) => {
    if (!onRowClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activateRow(row);
  };

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(col.align === 'right' && styles.numeric)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? styles.tableRowClickable : undefined}
                onClick={onRowClick ? () => activateRow(row) : undefined}
                onKeyDown={onRowKeyDown(row)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn(col.align === 'right' && styles.numeric)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cardList}>
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className={cn(styles.cardRow, onRowClick && styles.cardRowClickable)}
            onClick={onRowClick ? () => activateRow(row) : undefined}
            onKeyDown={onRowKeyDown(row)}
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? 'button' : undefined}
          >
            {columns
              .filter((col) => !col.hideOnMobile)
              .map((col, index) => {
                const hasHeader = col.header !== '';
                return (
                  <div
                    key={col.key}
                    className={cn(
                      styles.cardField,
                      index === 0 && styles.cardPrimary,
                      !hasHeader && styles.cardActions,
                      col.align === 'right' && styles.cardNumeric,
                    )}
                  >
                    {hasHeader && <div className={styles.cardLabel}>{col.header}</div>}
                    <div className={styles.cardValue}>{col.render(row)}</div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </>
  );
}
