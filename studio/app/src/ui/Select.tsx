import { useId } from 'react';
import { cx } from './cx';

export interface SelectOption<T extends string> { value: T; label: string }
export interface SelectProps<T extends string> {
  label: string;
  options: SelectOption<NoInfer<T>>[];
  value: T;
  onChange: (value: T) => void;
  /** Keeps the label for screen readers but does not show it. */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A labelled list to choose from. Uses the browser's own menu, so every key works as people expect. */
export function Select<T extends string>({ label, options, value, onChange, hideLabel, disabled, className }: SelectProps<T>) {
  const id = useId();
  return (
    <div className={cx('ui-field', className)}>
      <label htmlFor={id} className={cx('ui-field-label', hideLabel && 'visually-hidden')}>
        {label}
      </label>
      <select
        id={id}
        className="ui-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
