import type React from "react";

/**
 * One rebuilt screen in the Tulvo UI gallery.
 * Gallery registers it as composition "TulvoUi-<id>" (1512x805, 30 fps, 1 frame by default),
 * rendered inside <TulvoApp> so the scoped app CSS and Inter apply.
 *
 * Rules for `component`:
 *  - pure and props-driven: no useState/useEffect timers, no CSS transitions/animations;
 *    anything that moves is a prop (progress, typedChars, highlightId, cardOffsetX ...);
 *  - renders app content only (no <TulvoApp> wrapper: the gallery / AppStage adds it);
 *  - every visible string and number comes from props (defaults from ../fixtures).
 * `defaultProps` must be JSON-serialisable (Remotion requirement).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TulvoUiScreen<P extends Record<string, unknown> = any> = {
  /** Composition id suffix: "Shell" -> "TulvoUi-Shell". Letters, digits and "-" only. */
  id: string;
  component: React.ComponentType<P>;
  defaultProps: P;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
};
