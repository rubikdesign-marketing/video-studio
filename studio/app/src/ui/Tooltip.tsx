import { cloneElement, useId, useState, type ReactElement } from 'react';
import { cx } from './cx';

export interface TooltipProps {
  /** The words in the tip. */
  label: string;
  /** One control. It is described by the tip for screen readers. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: 'top' | 'bottom';
}

/** A short tip shown on hover and on keyboard focus. Escape hides it. */
export function Tooltip({ label, children, side = 'bottom' }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="ui-tooltip-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span id={id} role="tooltip" hidden={!open} className={cx('ui-tooltip', `ui-tooltip--${side}`)}>
        {label}
      </span>
    </span>
  );
}
