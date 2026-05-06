import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { useTopologyGraph, useUpdateAssetPosition } from '@/hooks/useTopology';
import { useT } from '@/i18n';
import type { Asset, AssetConnection, AssetKind, AssetStatus } from '@/types/topology';
import styles from './topology.module.css';

const KIND_ICON: Record<AssetKind, IconName> = {
  internet: 'globe',
  router: 'globe',
  switch: 'network',
  access_point: 'network',
  server: 'nodes',
  nas: 'database',
  desktop: 'cpu',
  laptop: 'cpu',
  lxc: 'cpu',
  vm: 'cpu',
  docker_host: 'services',
  ups: 'shield',
  external_disk: 'disk',
  camera: 'info',
  monitor: 'info',
  patch_panel: 'network',
  kvm: 'cpu',
};

const STATUS_CLASS: Record<AssetStatus, string> = {
  ok: '',
  warning: styles.warning ?? '',
  offline: styles.offline ?? '',
  unknown: styles.unknown ?? '',
};

const CARD_W = 168;
const CARD_H = 64;
const COL_GAP = 56;
const ROW_GAP = 28;
const PADDING = 32;

// Edges that define vertical hierarchy. Power/USB are peripheral — they don't push depth.
const HIERARCHY_KINDS = new Set(['ethernet', 'wifi', 'fiber']);

interface LaidOutAsset extends Asset {
  px: number;
  py: number;
}

function layoutAssets(assets: Asset[], connections: AssetConnection[]): {
  laid: LaidOutAsset[];
  width: number;
  height: number;
} {
  if (assets.length === 0) return { laid: [], width: 0, height: 0 };

  // Assets the user has dragged carry server-supplied positions; we keep
  // those exactly and only auto-layout the rest. This way layout output
  // is stable even if the operator only positioned some cards.
  const pinnedById = new Map<string, { x: number; y: number }>();
  for (const a of assets) {
    if (a.position) pinnedById.set(a.id, a.position);
  }

  // Build adjacency for hierarchy edges (undirected for traversal,
  // but directed for parent assignment — we treat `from` as parent).
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  for (const c of connections) {
    if (!HIERARCHY_KINDS.has(c.kind ?? 'ethernet')) continue;
    if (!childrenOf.has(c.from)) childrenOf.set(c.from, []);
    childrenOf.get(c.from)!.push(c.to);
    if (!parentsOf.has(c.to)) parentsOf.set(c.to, []);
    parentsOf.get(c.to)!.push(c.from);
  }

  // Pick roots: prefer kind=internet, else assets with no incoming hierarchy edge,
  // else fall back to first asset.
  const roots: string[] = [];
  for (const a of assets) {
    if (a.kind === 'internet') roots.push(a.id);
  }
  if (roots.length === 0) {
    for (const a of assets) {
      if (!parentsOf.has(a.id)) roots.push(a.id);
    }
  }
  if (roots.length === 0 && assets[0]) roots.push(assets[0].id);

  // BFS depth assignment (skip peripherals — they get pinned beside parent)
  const depth = new Map<string, number>();
  const peripheralKinds = new Set<AssetKind>(['ups', 'external_disk']);
  const queue: string[] = [];
  for (const r of roots) {
    depth.set(r, 0);
    queue.push(r);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const child of childrenOf.get(id) ?? []) {
      const childAsset = assets.find((a) => a.id === child);
      if (!childAsset) continue;
      if (peripheralKinds.has(childAsset.kind)) continue;
      if (depth.has(child)) continue;
      depth.set(child, d + 1);
      queue.push(child);
    }
  }

  // Any asset still without a depth (unconnected) → pin to last column
  const maxKnownDepth = Math.max(0, ...depth.values());
  const orphans: string[] = [];
  for (const a of assets) {
    if (peripheralKinds.has(a.kind)) continue;
    if (!depth.has(a.id)) orphans.push(a.id);
  }
  for (const id of orphans) depth.set(id, maxKnownDepth + 1);

  // Group by column
  const cols = new Map<number, string[]>();
  for (const [id, d] of depth) {
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d)!.push(id);
  }
  // Sort each column by name for stable order
  const assetById = new Map(assets.map((a) => [a.id, a]));
  for (const arr of cols.values()) {
    arr.sort((x, y) => {
      const ax = assetById.get(x)!;
      const ay = assetById.get(y)!;
      return ax.name.localeCompare(ay.name);
    });
  }

  const colKeys = [...cols.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(...[...cols.values()].map((v) => v.length));
  const contentH = maxRows * CARD_H + (maxRows - 1) * ROW_GAP;

  const positions = new Map<string, { x: number; y: number }>();
  colKeys.forEach((d, idx) => {
    const ids = cols.get(d)!;
    const colH = ids.length * CARD_H + (ids.length - 1) * ROW_GAP;
    const yStart = PADDING + (contentH - colH) / 2;
    ids.forEach((id, row) => {
      positions.set(id, {
        x: PADDING + idx * (CARD_W + COL_GAP),
        y: yStart + row * (CARD_H + ROW_GAP),
      });
    });
  });

  // Place peripherals: hang from their first parent, slightly offset down-left
  const peripherals = assets.filter((a) => peripheralKinds.has(a.kind));
  for (const p of peripherals) {
    const parent = parentsOf.get(p.id)?.[0] ?? childrenOf.get(p.id)?.[0];
    if (parent && positions.has(parent)) {
      const pp = positions.get(parent)!;
      // place to the left of parent, half-row down
      positions.set(p.id, {
        x: pp.x - CARD_W - COL_GAP / 2,
        y: pp.y + CARD_H + ROW_GAP / 2,
      });
    } else {
      // floating peripheral
      positions.set(p.id, {
        x: PADDING,
        y: PADDING + contentH + ROW_GAP,
      });
    }
  }

  // Compute final bounds (auto-positions + pinned positions both contribute)
  let maxX = 0;
  let maxY = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const { x, y } of positions.values()) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + CARD_W > maxX) maxX = x + CARD_W;
    if (y + CARD_H > maxY) maxY = y + CARD_H;
  }
  for (const { x, y } of pinnedById.values()) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + CARD_W > maxX) maxX = x + CARD_W;
    if (y + CARD_H > maxY) maxY = y + CARD_H;
  }
  // Shift so layout starts at PADDING even if peripherals went negative
  const shiftX = minX < PADDING ? PADDING - minX : 0;
  const shiftY = minY < PADDING ? PADDING - minY : 0;

  const laid: LaidOutAsset[] = assets.map((a) => {
    // Pinned (server-stored) positions are always honored verbatim — they're
    // the operator's intent. Auto-laid positions get the recentering shift.
    const pin = pinnedById.get(a.id);
    if (pin) {
      return { ...a, px: pin.x, py: pin.y };
    }
    const p = positions.get(a.id);
    return {
      ...a,
      px: (p?.x ?? PADDING) + shiftX,
      py: (p?.y ?? PADDING) + shiftY,
    };
  });

  return {
    laid,
    width: maxX + shiftX + PADDING,
    height: maxY + shiftY + PADDING,
  };
}

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

export function NetworkMap() {
  const t = useT();
  const query = useTopologyGraph();

  return (
    <Card flush>
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        loadingLabel={t('common.loading')}
      >
        {(graph) => <MapView assets={graph.assets} connections={graph.connections} />}
      </QueryBoundary>
    </Card>
  );
}

function MapView({ assets, connections }: { assets: Asset[]; connections: AssetConnection[] }) {
  const t = useT();
  const updatePosition = useUpdateAssetPosition();

  // Local overrides applied while dragging — they win over both server and
  // auto-laid positions, so motion is immediate. On drag end we PATCH the
  // server and keep the override in place until react-query refetches with
  // the same value.
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({});

  const enrichedAssets = useMemo(
    () =>
      assets.map((a) => {
        const o = overrides[a.id];
        return o ? { ...a, position: o } : a;
      }),
    [assets, overrides],
  );

  const { laid, width, height } = useMemo(
    () => layoutAssets(enrichedAssets, connections),
    [enrichedAssets, connections],
  );
  const byId = useMemo(() => new Map(laid.map((a) => [a.id, a])), [laid]);

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, tx: 0, ty: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPx: number;
    startPy: number;
    moved: boolean;
  } | null>(null);

  // Fit-to-view on first layout / when graph size changes
  const fittedRef = useRef<string>('');
  useEffect(() => {
    const key = `${width}x${height}`;
    if (fittedRef.current === key) return;
    const el = containerRef.current;
    if (!el || width === 0 || height === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const scale = Math.min(1, Math.min(r.width / width, r.height / height));
    const tx = (r.width - width * scale) / 2;
    const ty = (r.height - height * scale) / 2;
    setView({ scale, tx, ty });
    fittedRef.current = key;
  }, [width, height]);

  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of connections) {
      if (!m.has(c.from)) m.set(c.from, new Set());
      if (!m.has(c.to)) m.set(c.to, new Set());
      m.get(c.from)!.add(c.to);
      m.get(c.to)!.add(c.from);
    }
    return m;
  }, [connections]);

  const isHighlighted = (id: string) => {
    if (!hoverId) return true;
    if (id === hoverId) return true;
    return adjacency.get(hoverId)?.has(id) ?? false;
  };
  const isEdgeHighlighted = (c: AssetConnection) => {
    if (!hoverId) return true;
    return c.from === hoverId || c.to === hoverId;
  };

  const onWheel: React.WheelEventHandler = (e) => {
    if (!e.ctrlKey && !e.metaKey) {
      // pan via wheel by default; ctrl/cmd + wheel = zoom (browser standard)
      setView((v) => ({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }));
      return;
    }
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    setView((v) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = clamp(v.scale * factor, 0.3, 3);
      const k = next / v.scale;
      return {
        scale: next,
        tx: cx - (cx - v.tx) * k,
        ty: cy - (cy - v.ty) * k,
      };
    });
  };

  const onMouseDown: React.MouseEventHandler = (e) => {
    // Only start panning when clicking the background, not a card
    const target = e.target as Element;
    if (target.closest(`.${styles.assetGroup}`)) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onMouseMove: React.MouseEventHandler = (e) => {
    const p = panRef.current;
    if (!p) return;
    setView((v) => ({ ...v, tx: p.tx + (e.clientX - p.startX), ty: p.ty + (e.clientY - p.startY) }));
  };
  const stopPan = () => {
    panRef.current = null;
  };

  const resetView = () => {
    const el = containerRef.current;
    if (!el || width === 0) return;
    const r = el.getBoundingClientRect();
    const scale = Math.min(1, Math.min(r.width / width, r.height / height));
    setView({
      scale,
      tx: (r.width - width * scale) / 2,
      ty: (r.height - height * scale) / 2,
    });
  };

  const handleCardPointerDown = (a: LaidOutAsset) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: a.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPx: a.px,
      startPy: a.py,
      moved: false,
    };
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = (e.clientX - d.startClientX) / view.scale;
    const dy = (e.clientY - d.startClientY) / view.scale;
    if (!d.moved && Math.hypot(dx, dy) < 3) return; // dead zone
    d.moved = true;
    setOverrides((prev) => ({
      ...prev,
      [d.id]: { x: Math.round(d.startPx + dx), y: Math.round(d.startPy + dy) },
    }));
  };

  const handleCardPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) return;
    const next = overrides[d.id];
    if (!next) return;
    updatePosition.mutate({ id: d.id, x: next.x, y: next.y });
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = r.height / 2;
    setView((v) => {
      const next = clamp(v.scale * factor, 0.3, 3);
      const k = next / v.scale;
      return {
        scale: next,
        tx: cx - (cx - v.tx) * k,
        ty: cy - (cy - v.ty) * k,
      };
    });
  };

  return (
    <div
      ref={containerRef}
      className={styles.mapWrap}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
      role="presentation"
    >
      <div
        className={styles.canvas}
        style={{
          width,
          height,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg className={styles.canvasSvg} width={width} height={height}>
          <defs>
            <pattern id="topology-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.35" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#topology-grid)" />

          {connections.map((c) => {
            const from = byId.get(c.from);
            const to = byId.get(c.to);
            if (!from || !to) return null;
            const x1 = from.px + CARD_W / 2;
            const y1 = from.py + CARD_H / 2;
            const x2 = to.px + CARD_W / 2;
            const y2 = to.py + CARD_H / 2;
            const path = orthogonalPath(x1, y1, x2, y2);
            const cls = [
              styles.connection,
              styles[c.kind ?? 'ethernet'],
              isEdgeHighlighted(c) ? '' : styles.dim,
            ]
              .filter(Boolean)
              .join(' ');
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            return (
              <g key={c.id}>
                <path className={cls} d={path} />
                {c.label && (
                  <text
                    x={midX}
                    y={midY - 6}
                    textAnchor="middle"
                    className={styles.edgeLabel}
                  >
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {laid.map((a) => {
          const dim = !isHighlighted(a.id);
          const cls = [
            styles.assetCard,
            STATUS_CLASS[a.status],
            hoverId === a.id ? styles.active : '',
            dim ? styles.dim : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={a.id}
              className={`${styles.assetGroup}`}
              style={{
                position: 'absolute',
                left: a.px,
                top: a.py,
                width: CARD_W,
                height: CARD_H,
                touchAction: 'none',
                cursor: dragRef.current?.id === a.id ? 'grabbing' : 'grab',
              }}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId(null)}
              onPointerDown={handleCardPointerDown(a)}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerUp}
              onPointerCancel={handleCardPointerUp}
            >
              <div className={cls}>
                <div className={styles.assetIcon}>
                  <Icon name={KIND_ICON[a.kind]} size={18} />
                </div>
                <div className={styles.assetText}>
                  <div className={styles.assetLabel} title={a.name}>
                    {a.name}
                  </div>
                  <div className={styles.assetSub}>
                    {a.ip ?? t(`topology.kind.${a.kind}` as `topology.kind.server`)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.zoomControls}>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => zoomBy(1.2)}
          aria-label="Zoom in"
        >
          <Icon name="plus" size={14} />
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => zoomBy(1 / 1.2)}
          aria-label="Zoom out"
        >
          <Icon name="minus" size={14} />
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={resetView}
          aria-label="Reset view"
        >
          <Icon name="refresh" size={14} />
        </button>
        <div className={styles.zoomValue}>{Math.round(view.scale * 100)}%</div>
      </div>

      <div className={styles.legend}>
        {(['ethernet', 'wifi', 'fiber', 'power', 'usb'] as const).map((kind) => (
          <span key={kind} className={styles.legendItem}>
            <span className={`${styles.legendStroke} ${styles[kind]}`} />
            {t(`topology.connection.${kind}` as `topology.connection.ethernet`)}
          </span>
        ))}
      </div>
    </div>
  );
}

function orthogonalPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Mostly-horizontal layout: route via mid-x with a soft S-curve
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = x1 + dx / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  const my = y1 + dy / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
