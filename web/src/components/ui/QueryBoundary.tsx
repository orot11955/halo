import type { ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from './States';

interface QueryBoundaryProps<T> {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: ReactNode;
  emptyDetail?: ReactNode;
  loadingLabel?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * Centralizes the loading / error / empty / success rendering.
 * Pass an `isEmpty` predicate to opt into the empty state for a query.
 */
export function QueryBoundary<T>({
  isLoading,
  error,
  data,
  isEmpty,
  emptyTitle,
  emptyDetail,
  loadingLabel,
  children,
}: QueryBoundaryProps<T>) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState error={error} />;
  if (data === undefined) return <EmptyState />;
  if (isEmpty && isEmpty(data))
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  return <>{children(data)}</>;
}
