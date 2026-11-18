import { useId } from 'react';
import { cx } from './cx';

interface FieldBase {
  label: string;
  value: string;
  onChange(value: string): void;
  /** A short line of help under the field. */
  hint?: string;
  /** Shown in place of the hint when something is wrong. */
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
}
export type FieldProps = FieldBase &
  ({ multiline?: false; type?: 'text' | 'search' | 'email' | 'url' } | { multiline: true; rows?: number });

/** A labelled text box: one line, or several with `multiline`. */
export function Field(props: FieldProps) {
  const { label, value, onChange, hint, error, placeholder, disabled, name, className } = props;
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  const shared = {
    id,
    name,
    value,
    placeholder,
    disabled,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': note ? noteId : undefined,
  };
  return (
    <div className={cx('ui-field', className)}>
      <label htmlFor={id} className="ui-field-label">
        {label}
      </label>
      {props.multiline ? (
        <textarea {...shared} className="ui-input ui-input--multiline" rows={props.rows ?? 3} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...shared} className="ui-input" type={props.type ?? 'text'} onChange={(event) => onChange(event.target.value)} />
      )}
      {note ? (
        <p id={noteId} className={cx('ui-field-note', error && 'is-error')} role={error ? 'alert' : undefined}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
