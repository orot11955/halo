// Dashboard layout state — order, visibility, and column span per widget.
//
// Persisted to localStorage so a user's customized dashboard survives
// reloads. The grid system is intentionally simple (column span 1..3 on a
// 12-col bus) so we can swap in a real grid library later without
// changing widget components.

import { useCallback, useEffect, useMemo, useState } from 'react';

export type ColSpan = 1 | 2 | 3 | 4;

export interface DashboardWidgetLayout {
  id: string;
  /** column span on a 12-column row; widgets flow to the next row when full */
  span: ColSpan;
  /** false → hidden in the UI (still listed in customize panel) */
  visible: boolean;
}

export interface DashboardLayoutState {
  widgets: DashboardWidgetLayout[];
}

const STORAGE_KEY = 'halo.dashboard.layout.v1';

/** Default layout shipped with the app. The order here defines the
 *  initial top-to-bottom rendering and is also used to introduce new
 *  widgets that didn't exist when the user last saved their layout. */
export const DEFAULT_LAYOUT: DashboardLayoutState = {
  widgets: [
    { id: 'summary.nodes', span: 1, visible: true },
    { id: 'summary.services', span: 1, visible: true },
    { id: 'summary.domains', span: 1, visible: true },
    { id: 'alerts', span: 2, visible: true },
    { id: 'resources', span: 1, visible: true },
    { id: 'maintenance', span: 2, visible: true },
    { id: 'audit', span: 1, visible: true },
    { id: 'events', span: 3, visible: true },
  ],
};

function clone(state: DashboardLayoutState): DashboardLayoutState {
  return { widgets: state.widgets.map((w) => ({ ...w })) };
}

function loadStoredLayout(): DashboardLayoutState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardLayoutState;
    if (!parsed.widgets || !Array.isArray(parsed.widgets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLayout(state: DashboardLayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Reconciles a stored layout with the current default. Widgets present in
 * the default but missing from storage are appended (so newly-shipped
 * widgets show up after upgrade). Widgets in storage but not in the
 * default are dropped (so retired widgets disappear).
 */
function reconcile(stored: DashboardLayoutState | null): DashboardLayoutState {
  const defaultsById = new Map(DEFAULT_LAYOUT.widgets.map((w) => [w.id, w]));
  if (!stored) return clone(DEFAULT_LAYOUT);
  const valid = stored.widgets.filter((w) => defaultsById.has(w.id));
  const knownIds = new Set(valid.map((w) => w.id));
  const missing = DEFAULT_LAYOUT.widgets.filter((w) => !knownIds.has(w.id));
  return { widgets: [...valid, ...missing] };
}

export function useDashboardLayout() {
  const [state, setState] = useState<DashboardLayoutState>(() => reconcile(loadStoredLayout()));

  useEffect(() => {
    saveLayout(state);
  }, [state]);

  const reset = useCallback(() => setState(clone(DEFAULT_LAYOUT)), []);

  /** Move the widget at fromIndex so that it appears at toIndex. */
  const move = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || fromIndex >= prev.widgets.length) return prev;
      const next = clone(prev);
      const [moved] = next.widgets.splice(fromIndex, 1);
      const insertAt = Math.max(0, Math.min(toIndex, next.widgets.length));
      next.widgets.splice(insertAt, 0, moved);
      return next;
    });
  }, []);

  const setSpan = useCallback((id: string, span: ColSpan) => {
    setState((prev) => ({
      widgets: prev.widgets.map((w) => (w.id === id ? { ...w, span } : w)),
    }));
  }, []);

  const setVisible = useCallback((id: string, visible: boolean) => {
    setState((prev) => ({
      widgets: prev.widgets.map((w) => (w.id === id ? { ...w, visible } : w)),
    }));
  }, []);

  const visible = useMemo(() => state.widgets.filter((w) => w.visible), [state.widgets]);

  return { layout: state, visible, move, setSpan, setVisible, reset };
}
