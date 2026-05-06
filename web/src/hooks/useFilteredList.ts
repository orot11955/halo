import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterableConfig<T> {
  searchFields?: (keyof T)[];
  initialFilters?: Record<string, string>;
  /**
   * Filter keys that are exposed in controls/URLs but applied by the caller.
   * Use this for derived filters such as "warning and above" or resolved state.
   */
  manualFilterKeys?: string[];
  urlSync?: boolean | {
    searchParam?: string;
    filterParams?: Record<string, string>;
  };
}

export interface FilterableResult<T> {
  data: T[];
  search: string;
  setSearch: (s: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  total: number;
}

/**
 * Generic search + multi-key equality filter for lists.
 * Filter key 'all' is a sentinel that matches any value.
 */
export function useFilteredList<T extends object>(
  items: T[] | undefined,
  config: FilterableConfig<T> = {},
): FilterableResult<T> {
  const {
    searchFields = [],
    initialFilters: rawInitialFilters = {},
    manualFilterKeys = [],
    urlSync = false,
  } = config;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFiltersKey = JSON.stringify(rawInitialFilters);
  const manualFilterKeysKey = JSON.stringify(manualFilterKeys);
  const urlSyncKey = JSON.stringify(urlSync);
  const initialFilters = useMemo(
    () => rawInitialFilters,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialFiltersKey],
  );
  const manualFilterSet = useMemo(
    () => new Set(manualFilterKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manualFilterKeysKey],
  );
  const urlConfig = useMemo(
    () => (typeof urlSync === 'object' ? urlSync : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlSyncKey],
  );
  const syncEnabled = Boolean(urlSync);
  const searchParam = urlConfig?.searchParam ?? 'q';
  const filterParamMap = useMemo(() => {
    const explicit = urlConfig?.filterParams;
    if (explicit) return explicit;
    return Object.keys(initialFilters).reduce<Record<string, string>>((acc, key) => {
      acc[key] = key;
      return acc;
    }, {});
  }, [initialFilters, urlConfig]);

  const readUrlState = useCallback(() => {
    const nextFilters = { ...initialFilters };
    if (syncEnabled) {
      for (const [filterKey, paramKey] of Object.entries(filterParamMap)) {
        const value = searchParams.get(paramKey);
        if (value) nextFilters[filterKey] = value;
      }
    }
    return {
      search: syncEnabled ? searchParams.get(searchParam) ?? '' : '',
      filters: nextFilters,
    };
  }, [filterParamMap, initialFilters, searchParam, searchParams, syncEnabled]);

  const initialState = readUrlState;
  const [search, setSearchState] = useState(() => initialState().search);
  const [filters, setFilters] = useState<Record<string, string>>(() => initialState().filters);

  const writeUrlState = useCallback(
    (nextSearch: string, nextFilters: Record<string, string>) => {
      if (!syncEnabled) return;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const trimmed = nextSearch.trim();
          if (trimmed) params.set(searchParam, trimmed);
          else params.delete(searchParam);

          for (const [filterKey, paramKey] of Object.entries(filterParamMap)) {
            const value = nextFilters[filterKey];
            if (value && value !== 'all') params.set(paramKey, value);
            else params.delete(paramKey);
          }
          return params;
        },
        { replace: true },
      );
    },
    [filterParamMap, searchParam, setSearchParams, syncEnabled],
  );

  useEffect(() => {
    if (!syncEnabled) return;
    const next = readUrlState();
    setSearchState(next.search);
    setFilters(next.filters);
  }, [readUrlState, syncEnabled]);

  const data = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      for (const [key, value] of Object.entries(filters)) {
        if (manualFilterSet.has(key)) continue;
        if (!value || value === 'all') continue;
        if (String((item as Record<string, unknown>)[key]) !== value) return false;
      }
      if (!q) return true;
      if (searchFields.length === 0) {
        return Object.values(item as Record<string, unknown>).some(
          (v) => typeof v === 'string' && v.toLowerCase().includes(q),
        );
      }
      return searchFields.some((field) => {
        const v = item[field];
        return typeof v === 'string' && v.toLowerCase().includes(q);
      });
    });
  }, [items, search, filters, searchFields, manualFilterSet]);

  return {
    data,
    search,
    setSearch: (value) => {
      setSearchState(value);
      writeUrlState(value, filters);
    },
    filters,
    setFilter: (key, value) =>
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        writeUrlState(search, next);
        return next;
      }),
    resetFilters: () => {
      setFilters(initialFilters);
      setSearchState('');
      writeUrlState('', initialFilters);
    },
    total: items?.length ?? 0,
  };
}
