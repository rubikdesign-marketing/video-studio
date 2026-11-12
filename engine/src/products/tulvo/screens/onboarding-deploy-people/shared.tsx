/**
 * Small building blocks shared by the onboarding / deploy / people screens.
 * Class strings are verbatim from the DOM snapshots or the compiled app bundle.
 * Everything is pure and frame-agnostic: anything that moves is a prop.
 */
import React from "react";
import { X } from "lucide-react";

/** The live site's "Cookie settings" button (fixed, bottom-left). Same look as AppShell's. */
export const CookieSettingsButton: React.FC<{ label?: string }> = ({ label = "Cookie settings" }) => (
  <button
    id="tulvo-cookie-settings"
    type="button"
    style={{
      position: "fixed",
      bottom: 8,
      left: 8,
      zIndex: 2147482000,
      background: "white",
      color: "rgb(51, 51, 51)",
      border: "1px solid rgb(221, 221, 221)",
      borderRadius: 6,
      padding: "5px 8px",
      font: "12px system-ui",
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * shadcn Switch as the app renders it. `checked` sets the data-state (exact app look);
 * `progress` (0..1, optional) animates the knob and the track colour between the two states.
 */
export const Switch: React.FC<{
  id?: string;
  checked: boolean;
  progress?: number | null;
  className: string;
}> = ({ id, checked, progress, className }) => {
  const p = progress === null || progress === undefined ? (checked ? 1 : 0) : clamp01(progress);
  const mid = p > 0 && p < 1;
  const state = p >= 0.5 ? "checked" : "unchecked";
  return (
    <button
      id={id}
      className={className}
      type="button"
      role="switch"
      aria-checked={state === "checked"}
      data-state={state}
      value="on"
      style={mid ? { backgroundColor: `color-mix(in srgb, hsl(var(--primary)) ${p * 100}%, hsl(var(--input)))` } : undefined}
    >
      <span
        className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
        data-state={state}
        style={mid ? { transform: `translateX(${16 * p}px)` } : undefined}
      />
    </button>
  );
};

/**
 * A text caret drawn over a real <input>/<textarea> (a render has no live caret).
 * Renders an invisible mirror of the field's text with the same box metrics, followed by a
 * 1px caret, so the caret lands exactly after the last typed character (wrapping included).
 */
export const CaretMirror: React.FC<{
  text: string;
  /** Mirror box: padding/border/line metrics of the field it overlays. */
  style: React.CSSProperties;
  multiline?: boolean;
  visible: boolean;
  caretHeight?: number;
}> = ({ text, style, multiline = false, visible, caretHeight = 17 }) => {
  if (!visible) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        color: "transparent",
        whiteSpace: multiline ? "pre-wrap" : "pre",
        overflowWrap: multiline ? "break-word" : undefined,
        overflow: "hidden",
        ...style,
      }}
    >
      {text}
      <span
        style={{
          display: "inline-block",
          width: 1,
          height: caretHeight,
          marginLeft: 0,
          verticalAlign: "text-bottom",
          background: "hsl(var(--foreground))",
        }}
      />
    </div>
  );
};

/** Visible text for a typing animation: the first `typedChars` characters (all when null). */
export const typed = (text: string, typedChars: number | null | undefined): string =>
  typedChars === null || typedChars === undefined ? text : text.slice(0, Math.max(0, Math.floor(typedChars)));

/** Radix Dialog overlay as the app renders it (DialogOverlay `ZP`). `opacity` animates it (0..1). */
export const DialogOverlay: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div
    className="fixed inset-0 z-modal-backdrop bg-black/50  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    data-state="open"
    aria-hidden="true"
    style={{ pointerEvents: "auto", opacity }}
  />
);

/** The DialogContent close button (`cm` + X icon), verbatim. */
export const DialogCloseButton: React.FC = () => (
  <button
    className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
    type="button"
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </button>
);

/** Inline `vw` must follow the app window, not the composition: use this instead of "18vw". */
export const appVw = (n: number) => `calc(${n} * var(--tulvo-vw))`;
