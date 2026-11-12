/**
 * DEMO ONLY (composition "TulvoUi-Home-MotionDemo", 150 frames): shows how a parent drives the
 * Home screen from useCurrentFrame(). HomeScreen itself stays frame-agnostic.
 *
 * It shows the "a deal moved" beat the way the product really behaves (13-product-truth A5-5): the
 * live Home does NOT update while it is open; the new counts appear after a reload. So there is no
 * live re-split, only two static states and a hard cut:
 *
 *   0-59     BEFORE: capture-match counts (Prospecting 2, Pitch Sent 1), "about 2 hours ago"
 *   60       CUT (in the ad, the board move and the reload happen across this cut)
 *   60-119   AFTER THE RELOAD: Prospecting 1, Pitch Sent 2, "less than a minute ago". The page-load
 *            entry replays as measured live on 21 Oct: widgets, bars, pie and dots are there at
 *            once; only the trend line draws in (about 1500 ms, CSS ease, from about 115 ms after
 *            mount) and its value labels appear when it completes.
 *   116-150  the pie's "7 categories" footer is hovered and clicked (frame 120): the footer reads
 *            "Hide details", the popover opens over 200 ms ease-out (verified live, day3/), and the
 *            pointer then rests on the Pitch Sent row.
 */
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { TulvoUiScreen } from "../types";
import { HomeScreen, homeAfterMoveScreen, homeScreen, type HomeScreenProps } from "./HomeScreen";
import type { HomeCategory } from "./types";

export type HomeMotionDemoProps = HomeScreenProps & {
  /** Frame of the hard cut from the before state (the base props) to the after-reload state. */
  cutFrame: number;
  /** Whole counts after the reload (see moveDeal()). */
  afterCategories: HomeCategory[];
  /** KPI timestamp after the reload, e.g. "less than a minute ago". */
  afterUpdatedLabel: string;
};

/** CSS `ease`, recharts' default easing (fitted to the live line draw: 1490 ms, error 0.0009). */
const cssEase = Easing.bezier(0.25, 0.1, 0.25, 1);
/** Tailwind `ease-out`, the popover's transition timing. */
const twEaseOut = Easing.bezier(0, 0, 0.2, 1);
const ramp = (f: number, a: number, b: number, easing: (t: number) => number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

const FPS = 30;
const LINE_DELAY = 0.115 * FPS; // about 3.5 frames after mount
const LINE_DURATION = 1.5 * FPS; // 45 frames
const CLICK = 120;
const POPOVER = 0.2 * FPS; // 6 frames

export const HomeMotionDemo: React.FC<HomeMotionDemoProps> = ({ cutFrame, afterCategories, afterUpdatedLabel, ...before }) => {
  const f = useCurrentFrame();
  if (f < cutFrame) return <HomeScreen {...before} />;

  const lineStart = cutFrame + LINE_DELAY;
  return (
    <HomeScreen
      {...before}
      categories={afterCategories}
      updatedLabel={afterUpdatedLabel}
      trendDrawProgress={ramp(f, lineStart, lineStart + LINE_DURATION, cssEase)}
      pieLegendOpen={ramp(f, CLICK, CLICK + POPOVER, twEaseOut)}
      pieLegendExpanded={f >= CLICK}
      piePointer={f >= CLICK - 4 && f < CLICK + 12 ? "footer" : f >= CLICK + 12 ? "widget" : "outside"}
      pieLegendHoverIndex={f >= CLICK + 12 ? 1 : null}
    />
  );
};

export const homeMotionDemoScreen: TulvoUiScreen<HomeMotionDemoProps> = {
  id: "Home-MotionDemo",
  component: HomeMotionDemo,
  defaultProps: {
    ...homeScreen.defaultProps,
    cutFrame: 60,
    afterCategories: homeAfterMoveScreen.defaultProps.categories,
    afterUpdatedLabel: homeAfterMoveScreen.defaultProps.updatedLabel,
  },
  durationInFrames: 150,
};
