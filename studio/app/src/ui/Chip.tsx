import type { ReactNode } from 'react';
import { cx } from './cx';

export interface ChipProps {
  children: ReactNode;
  /** Shown as picked. With `onClick` it is also announced as pressed. */
  selected?: boolean;
  /** Makes the chip a button. Without it the chip is a plain label. */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Chip({ children, selected = false, onClick, disabled, className }: ChipProps) {
  const names = cx('ui-chip', selected && 'is-selected', className);
  if (!onClick) return <span className={names}>{children}</span>;
  return (
    <button type="button" className={names} aria-pressed={selected} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
