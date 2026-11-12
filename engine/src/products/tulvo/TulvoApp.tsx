import React from "react";
import "./app.scoped.css";
// Use an export: package.json declares `"sideEffects": ["*.css"]`, so webpack drops a bare
// `import "./fonts"` and the font loader would never run.
import { INTER_FAMILY } from "./fonts";
import { cn } from "./cn";

/** The live captures were taken at this CSS viewport (DPR 2). */
export const APP_WIDTH = 1512;
export const APP_HEIGHT = 805;

export type TulvoAppProps = {
  /** CSS px width of the app "window". Drives --tulvo-vw (100vw == width). */
  width?: number;
  /** CSS px height of the app "window". Drives --tulvo-vh (100vh == height). */
  height?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Root of every rebuilt Tulvo screen. Recreates the live document skeleton
 *   html.light            -> div.tulvo-app.light   (:root / html rules land here)
 *   body.customScroll     -> div.tulvo-body.customScroll (body rules land here)
 *   div#root              -> div.tulvo-root
 * at a fixed desktop size, so app.scoped.css applies exactly as in the browser.
 *
 * - Only elements inside this component are styled by the app CSS (see tools/scope-css.mjs).
 * - `contain: layout paint` makes it the containing block for the app's position:fixed
 *   elements (dialogs, toasts, the cookie button), so they stay inside the app window.
 * - Never scale it by changing font-size or width: wrap it in <AppStage> (CSS transform).
 */
export const TulvoApp: React.FC<TulvoAppProps> = ({
  width = APP_WIDTH,
  height = APP_HEIGHT,
  children,
  className,
  style,
}) => {
  const vars = {
    "--tulvo-vw": `${width / 100}px`,
    "--tulvo-vh": `${height / 100}px`,
  } as React.CSSProperties;
  return (
    <div
      className={cn("tulvo-app light", className)}
      data-font={INTER_FAMILY}
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        contain: "layout paint",
        ...vars,
        ...style,
      }}
    >
      <div className="tulvo-body customScroll">
        <div className="tulvo-root">{children}</div>
      </div>
    </div>
  );
};

export type AppStageProps = TulvoAppProps & {
  /** Uniform scale applied with a CSS transform (1 = native 1512x805). */
  scale?: number;
  /** Translation in composition px, applied before scaling (use to crop / pan for 9:16). */
  x?: number;
  y?: number;
  /** Extra transform appended after translate+scale (e.g. a subtle perspective tilt). */
  transform?: string;
  stageStyle?: React.CSSProperties;
};

/**
 * Places a native-size TulvoApp inside any composition (e.g. 1080x1920) by transform only,
 * so layout, media queries and text metrics stay identical to the 1512x805 capture.
 * All values are plain props: drive them from useCurrentFrame() in the parent.
 */
export const AppStage: React.FC<AppStageProps> = ({
  scale = 1,
  x = 0,
  y = 0,
  transform,
  stageStyle,
  ...app
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      transformOrigin: "0 0",
      transform: `translate(${x}px, ${y}px) scale(${scale})${transform ? ` ${transform}` : ""}`,
      ...stageStyle,
    }}
  >
    <TulvoApp {...app} />
  </div>
);
