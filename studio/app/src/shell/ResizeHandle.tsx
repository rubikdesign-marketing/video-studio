import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { cx } from '../ui';
import { PANEL_LIMITS, usePanelsStore, type PanelName } from './panels';

const STEP = 16;
const BIG_STEP = 64;

const labels: Record<PanelName, string> = {
  left: 'Resize the left panel',
  right: 'Resize the right panel',
  timeline: 'Resize the timeline',
};

/** The bar between a panel and the canvas. Drag it, or focus it and use the arrow keys. */
export function ResizeHandle({ panel, controls }: { panel: PanelName; controls: string }) {
  const size = usePanelsStore((state) => state.sizes[panel]);
  const resize = usePanelsStore((state) => state.resize);
  const drag = useRef<{ from: number; size: number } | null>(null);
  const horizontal = panel === 'timeline';
  const { min, max } = PANEL_LIMITS[panel];

  // Which way the pointer or an arrow key grows the panel.
  const point = (event: { clientX: number; clientY: number }) => (horizontal ? event.clientY : event.clientX);
  const grows = panel === 'left' ? 1 : -1;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { from: point(event), size };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    resize(panel, drag.current.size + (point(event) - drag.current.from) * grows);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const more = horizontal ? 'ArrowUp' : panel === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const less = horizontal ? 'ArrowDown' : panel === 'left' ? 'ArrowLeft' : 'ArrowRight';
    const next =
      event.key === more ? size + step
      : event.key === less ? size - step
      : event.key === 'Home' ? min
      : event.key === 'End' ? max
      : null;
    if (next === null) return;
    event.preventDefault();
    resize(panel, next);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={labels[panel]}
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-controls={controls}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cx('shell-handle', horizontal ? 'shell-handle--row' : 'shell-handle--column')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}
