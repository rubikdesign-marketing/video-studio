import { useEffect, type ReactNode } from 'react';
import { Button, cx } from '../ui';
import { ResizeHandle } from './ResizeHandle';
import { NARROW_QUERY, usePanelsStore, type PanelName } from './panels';
import './shell.css';

export interface ShellProps {
  /** Film, version, reviewer, theme, render status. */
  topBar: ReactNode;
  /** An optional panel on the left. Review has none (EDITOR-V2-PLAN.md, phase A); without it there is no switch for it. */
  left?: ReactNode;
  /** The film, its overlays and the floating toolbar. */
  canvas: ReactNode;
  /** The notes rail: notes, the composer, and the inspector while something is selected. */
  right: ReactNode;
  /** Ruler and lanes. */
  timeline: ReactNode;
  /** Names for the switches, so they say what the panel holds rather than where it is. */
  names?: Partial<Record<PanelName, string>>;
  /** False when the page offers the panel switches somewhere else (Review puts them in the You menu). On a narrow
   * window they always show, because the side panels are drawers there and need a way in. */
  toggles?: boolean;
}

const defaultNames: Record<PanelName, string> = { left: 'Left', right: 'Notes', timeline: 'Timeline' };

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
export function Shell({ topBar, left, canvas, right, timeline, names, toggles: showToggles = true }: ShellProps) {
  useNarrowWatch();
  const { sizes, narrow, drawer, toggle, isOpen: open, closeDrawer } = usePanelsStore();
  const hasLeft = left !== undefined && left !== null;
  const isOpen = (name: PanelName) => (name === 'left' && !hasLeft ? false : open(name));
  const label = { ...defaultNames, ...names };
  const toggles = (['left', 'right', 'timeline'] as PanelName[])
    .filter((name) => name !== 'left' || hasLeft)
    .map((name) => ({ name, label: label[name], title: `Show or hide the ${label[name].toLowerCase()} panel` }));

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
        {showToggles || narrow ? <div className="shell-toggles" role="group" aria-label="Panels">
          {toggles.map(({ name, label, title }) => (
            <Button key={name} variant="quiet" aria-pressed={isOpen(name)} aria-label={title} title={title} onClick={() => toggle(name)}>
              {label}
            </Button>
          ))}
        </div> : null}
      </header>

      <div className="shell-middle">
        {hasLeft ? side('left', `${label.left} panel`, left) : null}
        {hasLeft && !narrow && isOpen('left') ? <ResizeHandle panel="left" controls="shell-left" /> : null}
        <main className="shell-canvas" aria-label="Canvas">
          {canvas}
        </main>
        {!narrow && isOpen('right') ? <ResizeHandle panel="right" controls="shell-right" /> : null}
        {side('right', `${label.right} panel`, right)}
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
