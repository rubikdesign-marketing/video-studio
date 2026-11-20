import { create } from 'zustand';
import { Button } from './Button';
import { cx } from './cx';

export type ToastTone = 'plain' | 'good' | 'warn';
export interface ToastItem { id: number; message: string; tone: ToastTone }
export interface ToastOptions {
  tone?: ToastTone;
  /** Milliseconds before it leaves by itself. 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastState { toasts: ToastItem[] }

let nextId = 1;
export const useToasts = create<ToastState>(() => ({ toasts: [] }));

export function dismissToast(id: number): void {
  useToasts.setState((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
}

/** Shows a short message in the corner. Returns its id. */
export function showToast(message: string, { tone = 'plain', duration = 5000 }: ToastOptions = {}): number {
  const id = nextId++;
  useToasts.setState((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

const toneLabel: Record<ToastTone, string> = { plain: '', good: 'Done: ', warn: 'Heads up: ' };

/** Render once, near the root. Messages are read out politely by screen readers. */
export function Toasts() {
  const toasts = useToasts((state) => state.toasts);
  return (
    <div className="ui-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx('ui-toast', `ui-toast--${toast.tone}`)}>
          <span className="ui-toast-mark" aria-hidden="true" />
          <p className="ui-toast-message">
            {toneLabel[toast.tone] ? <span className="visually-hidden">{toneLabel[toast.tone]}</span> : null}
            {toast.message}
          </p>
          <Button variant="quiet" onClick={() => dismissToast(toast.id)}>
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}
