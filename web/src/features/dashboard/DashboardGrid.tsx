import { useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';
import type { ColSpan, DashboardWidgetLayout } from './dashboardLayout';
import styles from './DashboardGrid.module.css';

const SPAN_OPTIONS: ColSpan[] = [1, 2, 3];

function spanClass(span: ColSpan) {
  switch (span) {
    case 1:
      return styles.span1;
    case 2:
      return styles.span2;
    case 3:
      return styles.span3;
    default:
      return styles.span4;
  }
}

interface SortableCellProps {
  layout: DashboardWidgetLayout;
  editing: boolean;
  isDraggingActive: boolean;
  onSpanChange: (id: string, span: ColSpan) => void;
  onHide: (id: string) => void;
  children: ReactNode;
}

function SortableCell({
  layout,
  editing,
  isDraggingActive,
  onSpanChange,
  onHide,
  children,
}: SortableCellProps) {
  const t = useT();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: layout.id, disabled: !editing });

  // Drop target highlight: only when something else is being dragged over
  // *this* cell. `isOver` from useSortable already encodes both conditions.
  const showAsTarget = isOver && !isDragging && isDraggingActive;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        styles.cell,
        spanClass(layout.span),
        editing ? styles.editing : '',
        isDragging ? styles.dragging : '',
        showAsTarget ? styles.dropTarget : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {editing && (
        <div className={styles.handle}>
          <button
            type="button"
            // Drag handle: keyboard users press Space/Enter on this button
            // to "pick up" the widget, then arrow keys to move it.
            className={styles.dragHandleBtn}
            aria-label={t('dashboard.customize.handle')}
            {...attributes}
            {...listeners}
          >
            <Icon name="dashboard" size={11} />
          </button>
          <span className={styles.spanControl}>
            {SPAN_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.spanBtn} ${layout.span === s ? styles.active : ''}`}
                onClick={() => onSpanChange(layout.id, s)}
                title={t('dashboard.customize.span').replace('{n}', String(s))}
              >
                {s}
              </button>
            ))}
          </span>
          <button
            type="button"
            className={styles.hideBtn}
            onClick={() => onHide(layout.id)}
            title={t('dashboard.customize.hide')}
          >
            <Icon name="x" size={11} />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

interface GridProps {
  visible: DashboardWidgetLayout[];
  hidden: DashboardWidgetLayout[];
  editing: boolean;
  renderWidget: (id: string) => ReactNode;
  onMove: (fromIndex: number, toIndex: number) => void;
  onSpanChange: (id: string, span: ColSpan) => void;
  onShow: (id: string) => void;
  onHide: (id: string) => void;
}

export function DashboardGrid({
  visible,
  hidden,
  editing,
  renderWidget,
  onMove,
  onSpanChange,
  onShow,
  onHide,
}: GridProps) {
  const t = useT();
  const [activeId, setActiveId] = useState<string | null>(null);

  // PointerSensor + TouchSensor + KeyboardSensor cover desktop, mobile,
  // and a11y in one go. The 6px activation distance prevents accidental
  // drags when the user just clicks a span/hide button on the handle.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId || overId === e.active.id) return;
    const fromIndex = visible.findIndex((w) => w.id === e.active.id);
    const toIndex = visible.findIndex((w) => w.id === overId);
    if (fromIndex < 0 || toIndex < 0) return;
    // arrayMove gives us the *resulting* destination index — perfect for
    // our move() reducer.
    const reordered = arrayMove(visible, fromIndex, toIndex);
    const newDestIndex = reordered.findIndex((w) => w.id === e.active.id);
    onMove(fromIndex, newDestIndex);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={visible.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className={styles.grid}>
            {visible.map((w) => (
              <SortableCell
                key={w.id}
                layout={w}
                editing={editing}
                isDraggingActive={activeId !== null}
                onSpanChange={onSpanChange}
                onHide={onHide}
              >
                {renderWidget(w.id)}
              </SortableCell>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editing && hidden.length > 0 && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}
          >
            {t('dashboard.customize.hidden')}
          </div>
          {hidden.map((w) => (
            <div key={w.id} className={styles.hidden}>
              <span className={styles.hiddenLabel}>{w.id}</span>
              <Button size="sm" onClick={() => onShow(w.id)}>
                <Icon name="plus" size={12} />
                {t('dashboard.customize.show')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
