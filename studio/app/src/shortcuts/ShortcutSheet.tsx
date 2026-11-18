import { useEffect, useRef } from 'react';
import type { Shortcut } from '../contracts/store';
import { KeyCaps } from './KeyCaps';
import './shortcuts.css';
import { closeSheet, groupShortcuts } from './table';
import { useShortcutState } from './useShortcuts';

/** The sheet itself, given its shortcuts. `ShortcutSheet` is the one to put on the page. */
export function ShortcutSheetView({ shortcuts, onClose, mac }: { shortcuts: Shortcut[]; onClose(): void; mac?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => before?.focus?.();
  }, []);
  const groups = groupShortcuts(shortcuts);
  return (
    <div className="sc-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-panel sc-sheet" role="dialog" aria-modal="true" aria-labelledby="sc-sheet-title" tabIndex={-1} ref={panel}>
        <div className="sc-head">
          <h2 className="sc-title" id="sc-sheet-title">Keyboard shortcuts</h2>
          <button type="button" className="sc-close" onClick={onClose}>Close</button>
        </div>
        <div className="sc-body">
          {groups.length === 0 ? <p className="sc-empty">There are no shortcuts yet.</p> : (
            <div className="sc-groups">
              {groups.map((g) => (
                <section key={g.group} aria-label={g.group}>
                  <h3 className="sc-group-name">{g.group}</h3>
                  <ul className="sc-list">
                    {g.shortcuts.map((s) => <li className="sc-row" key={s.id}><span>{s.label}</span><KeyCaps keys={s.keys} mac={mac} /></li>)}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Every shortcut, by group. Opens on "?", closes on Escape, the Close button or a click outside. */
export function ShortcutSheet() {
  const open = useShortcutState((s) => s.sheetOpen);
  const shortcuts = useShortcutState((s) => s.shortcuts);
  return open ? <ShortcutSheetView shortcuts={shortcuts} onClose={closeSheet} /> : null;
}
