import { useRef, type KeyboardEvent } from 'react';
import { cx } from './cx';

export interface SegmentedOption<T extends string> { value: T; label: string }
export interface SegmentedProps<T extends string> {
  /** Read out by screen readers. Not shown. */
  label: string;
  options: SegmentedOption<NoInfer<T>>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Pick one of a few. Arrow keys move the choice, like a radio group. */
export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent, index: number) => {
    const last = options.length - 1;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : -1;
    const option = options[next];
    if (!option) return;
    event.preventDefault();
    onChange(option.value);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div ref={group} role="radiogroup" aria-label={label} className={cx('ui-segmented', className)}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={cx('ui-segmented-option', checked && 'is-selected')}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
