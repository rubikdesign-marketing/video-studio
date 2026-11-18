import { useEffect, type ReactNode } from 'react';
import { Button, cx } from '../ui';
import { ResizeHandle } from './ResizeHandle';
import { NARROW_QUERY, usePanelsStore, type PanelName } from './panels';
import './shell.css';

export interface ShellProps {
  /** Film, version, reviewer, theme, render status. */
  topBar: ReactNode;
  /** Scenes, notes, versions. */
  left: ReactNode;
  /** The film, its overlays and the floating toolbar. */
  canvas: ReactNode;
  /** Inspector and note editor. */
  right: ReactNode;
  /** Ruler and lanes. */
  timeline: ReactNode;
}

const toggles: { name: PanelName; label: string; title: string }[] = [
  { name: 'left', label: 'Left', title: 'Show or hide the left panel' },
  { name: 'right', label: 'Right', title: 'Show or hide the right panel' },
  { name: 'timeline', label: 'Timeline', title: 'Show or hide the timeline' },
];

/** Keeps the store's `narrow` flag in step with the window width. */
function useNarrowWatch(): void {
  const setNarrow = usePanelsStore((state) => state.setNarrow);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [setNarrow]);
}

/** The workspace: top bar, left panel, canvas, right panel and timeline (ARCHITECTURE_PLAN.md section 3.2). */
export function Shell({ topBar, left, canvas, right, timeline }: ShellProps) {
  useNarrowWatch();
  const { sizes, narrow, drawer, toggle, isOpen, closeDrawer } = usePanelsStore();

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, closeDrawer]);

  const side = (name: 'left' | 'right', label: string, content: ReactNode) => (
    <aside
      id={`shell-${name}`}
      aria-label={label}
      hidden={!isOpen(name)}
      className={cx('shell-panel', `shell-panel--${name}`, narrow && 'is-drawer')}
      style={{ width: sizes[name] }}
    >
      {content}
    </aside>
  );

  return (
    <div className={cx('shell', narrow && 'is-narrow')}>
      <header className="shell-top">
        <div className="shell-top-slot">{topBar}</div>
        <div className="shell-toggles" role="group" aria-label="Panels">
          {toggles.map(({ name, label, title }) => (
            <Button key={name} variant="quiet" aria-pressed={isOpen(name)} aria-label={title} title={title} onClick={() => toggle(name)}>
              {label}
            </Button>
          ))}
        </div>
      </header>

      <div className="shell-middle">
        {side('left', 'Left panel', left)}
        {!narrow && isOpen('left') ? <ResizeHandle panel="left" controls="shell-left" /> : null}
        <main className="shell-canvas" aria-label="Canvas">
          {canvas}
        </main>
        {!narrow && isOpen('right') ? <ResizeHandle panel="right" controls="shell-right" /> : null}
        {side('right', 'Right panel', right)}
        {narrow && drawer ? (
          <button type="button" className="shell-scrim" aria-label="Close the panel" onClick={closeDrawer} />
        ) : null}
      </div>

      {isOpen('timeline') ? <ResizeHandle panel="timeline" controls="shell-timeline" /> : null}
      <section
        id="shell-timeline"
        aria-label="Timeline"
        hidden={!isOpen('timeline')}
        className="shell-timeline"
        style={{ height: sizes.timeline }}
      >
        {timeline}
      </section>
    </div>
  );
}
