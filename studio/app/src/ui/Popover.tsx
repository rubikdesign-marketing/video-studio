import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { cx } from './cx';

export interface PopoverProps {
  /** What the button shows. */
  label: ReactNode;
  /** Read out for the button when its label is not words on their own. */
  ariaLabel?: string;
  title?: string;
  variant?: ButtonVariant;
  /** Which edge of the button the panel lines up with. */
  align?: 'start' | 'end';
  /** Opens above the button, for a control at the bottom of the screen. */
  up?: boolean;
  /** Shows the button as on, for a menu whose settings are in use. */
  pressed?: boolean;
  className?: string;
  panelClassName?: string;
  /** The panel. Gets a function that closes it, for items that act and then go away. */
  children: (close: () => void) => ReactNode;
}

/** A button with a small panel under it. Closes on Escape, on a click outside, and when an item asks it to. */
export function Popover({ label, ariaLabel, title, variant = 'quiet', align = 'start', up = false, pressed, className, panelClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', onKey, true);
    // The first control in the panel takes the focus, so the keyboard can carry on from the button.
    root.current?.querySelector<HTMLElement>('.ui-popover-panel input, .ui-popover-panel textarea, .ui-popover-panel button')?.focus();
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <span ref={root} className={cx('ui-popover', className)}>
      <Button
        variant={variant}
        aria-label={ariaLabel}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-pressed={pressed}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      {open ? (
        <div id={id} role="dialog" aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
          className={cx('ui-popover-panel', `ui-popover-panel--${align}`, up && 'ui-popover-panel--up', panelClassName)}>
          {children(close)}
        </div>
      ) : null}
    </span>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  /** Shows a tick, for an item that is on. Announced as checked. */
  checked?: boolean;
  /** A key or a short note on the right. */
  hint?: ReactNode;
  disabled?: boolean;
}

/** One row of a popover menu. */
export function MenuItem({ children, onClick, checked, hint, disabled }: MenuItemProps) {
  const toggle = checked !== undefined;
  return (
    <button type="button" className="ui-menu-item" role={toggle ? 'menuitemcheckbox' : 'menuitem'} aria-checked={toggle ? checked : undefined}
      disabled={disabled} onClick={onClick}>
      <span className="ui-menu-tick" aria-hidden="true">{checked ? '✓' : ''}</span>
      <span>{children}</span>
      {hint ? <span className="ui-menu-hint">{hint}</span> : null}
    </button>
  );
}
