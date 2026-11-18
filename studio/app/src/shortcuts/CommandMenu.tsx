import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Shortcut } from '../contracts/store';
import { KeyCaps } from './KeyCaps';
import './shortcuts.css';
import { closeMenu, filterShortcuts } from './table';
import { useShortcutState } from './useShortcuts';

interface ViewProps {
  shortcuts: Shortcut[]; query: string; active: number; mac?: boolean;
  onQuery(query: string): void; onActive(index: number): void; onRun(shortcut: Shortcut): void; onClose(): void;
}

/** The menu itself, given what is typed and which row is lit. `CommandMenu` is the one to put on the page. */
export function CommandMenuView({ shortcuts, query, active, mac, onQuery, onActive, onRun, onClose }: ViewProps) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => before?.focus?.();
  }, []);
  const found = filterShortcuts(shortcuts, query);
  const lit = Math.min(active, Math.max(0, found.length - 1));
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [lit, query]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); onActive(found.length ? (lit + 1) % found.length : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onActive(found.length ? (lit - 1 + found.length) % found.length : 0); }
    else if (e.key === 'Enter') { e.preventDefault(); const pick = found[lit]; if (pick) onRun(pick); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };
  return (
    <div className="sc-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-panel" role="dialog" aria-modal="true" aria-label="Find a command">
        <input
          ref={input} className="sc-input" type="text" value={query} placeholder="Type what you want to do"
          role="combobox" aria-expanded="true" aria-controls="sc-options" aria-autocomplete="list"
          aria-activedescendant={found[lit] ? `sc-option-${found[lit].id}` : undefined} aria-label="Find a command"
          autoComplete="off" spellCheck={false}
          onChange={(e) => { onQuery(e.target.value); onActive(0); }} onKeyDown={onKeyDown}
        />
        {found.length === 0 ? <p className="sc-empty" role="status">Nothing matches “{query}”. Try another word.</p> : (
          <ul className="sc-options" id="sc-options" role="listbox" aria-label="Commands" ref={list}>
            {found.map((s, i) => (
              <li
                key={s.id} id={`sc-option-${s.id}`} className="sc-option" role="option" aria-selected={i === lit}
                onMouseMove={() => { if (i !== lit) onActive(i); }} onMouseDown={(e) => e.preventDefault()} onClick={() => onRun(s)}
              >
                <span>{s.label}<span className="sc-option-group">{s.group}</span></span>
                <KeyCaps keys={s.keys} mac={mac} />
              </li>
            ))}
          </ul>
        )}
        <p className="sc-hidden" role="status">{found.length === 1 ? '1 command' : `${found.length} commands`}</p>
      </div>
    </div>
  );
}

function OpenMenu({ shortcuts }: { shortcuts: Shortcut[] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  return (
    <CommandMenuView
      shortcuts={shortcuts} query={query} active={active} onQuery={setQuery} onActive={setActive} onClose={closeMenu}
      onRun={(s) => { closeMenu(); s.run(); }}
    />
  );
}

/** Every command, found by typing. Opens on Cmd+K (Ctrl+K), arrows to move, Enter to run, Escape to close. */
export function CommandMenu() {
  const open = useShortcutState((s) => s.menuOpen);
  const shortcuts = useShortcutState((s) => s.shortcuts);
  return open ? <OpenMenu shortcuts={shortcuts} /> : null;
}
